export const DAILY_SCORES = 60;
export const MATCH_MODEL = "@cf/cloudflare/clef";

const LEVELS = {
  skills: [
    "Shows none or almost none of the required skills",
    "Shows some of the required skills",
    "Shows most of the required skills",
    "Shows all or nearly all of the required skills",
  ],
  experience: [
    "Far short of the experience asked for",
    "Somewhat short of the experience asked for",
    "Meets the experience asked for",
    "Exceeds the experience asked for",
  ],
  domain: [
    "Past work is unrelated to this role",
    "Past work is loosely related to this role",
    "Past work is closely related to this role",
    "Past work is the same kind of work as this role",
  ],
};

const WEIGHTS = { skills: 0.45, experience: 0.3, domain: 0.25 };

type Dimension = keyof typeof LEVELS;
type ScoreAnswer = { score: number; confidence: number | null };
type ClefResponse = {
  answers: Record<Dimension, ScoreAnswer> & {
    hard_requirements: { noul: number };
  };
};

export type JobMatch = {
  match: number;
  skills: number;
  experience: number;
  domain: number;
  meetsHardRequirements: number;
  confidence: number | null;
};

const HEADER_LINES = 6;
const NAME = /^\p{Lu}[\p{L}'.-]*(?:\s+\p{Lu}[\p{L}'.-]*){1,3}$/u;
const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
const URL = /\b(?:https?:\/\/|www\.)[^\s),;]+/gi;
const PROFILE =
  /\b(?:linkedin|github|gitlab|behance|dribbble|medium|twitter|x)\.com\/[^\s),;]*/gi;
const US_PHONE = /(?:\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;
const INTL_PHONE = /\+\d{1,3}(?:[\s.-]?\(?\d{1,4}\)?){2,5}/g;
const SITE =
  /\b[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|io|dev|me|co|app|site|page|tech|xyz)\b(?:\/[^\s),;]*)?/gi;
const HANDLE = /(^|[\s(|·•])@\w{2,30}\b/g;
const CONTACT_LINE =
  /[|·•@]|\d{3}[\s.-]?\d{4}|linkedin|github|portfolio|website|^\s*\S+\.[a-z]{2,}\S*\s*$/i;
const STREET =
  /\b\d{1,6}\s+(?:[\w.'-]+\s){1,4}(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Dr|Drive|Ln|Lane|Way|Ct|Court|Pl|Place)\b\.?/g;

function nameIn(line: string) {
  const candidate = line
    .replace(/^[#*\s]+/, "")
    .split(/[|,·•–—]/)[0]
    .trim();
  return NAME.test(candidate) ? candidate : null;
}

export function redact(resume: string) {
  const lines = resume.split("\n");
  const first = lines.find((line) => line.trim());
  const name = first ? nameIn(first) : null;
  let seen = 0;
  const redacted = lines
    .map((line) => {
      if (!line.trim() || seen++ >= HEADER_LINES) return line;
      const withoutAddress = line.replace(STREET, "[address]");
      return CONTACT_LINE.test(line)
        ? withoutAddress
            .replace(HANDLE, "$1[handle]")
            .replace(EMAIL, "[email]")
            .replace(SITE, "[link]")
        : withoutAddress;
    })
    .join("\n")
    .replace(EMAIL, "[email]")
    .replace(URL, "[link]")
    .replace(PROFILE, "[link]")
    .replace(INTL_PHONE, "[phone]")
    .replace(US_PHONE, "[phone]");
  if (!name) return redacted;
  const parts = [name, ...name.split(/\s+/).filter((part) => part.length > 1)];
  return parts.reduce(
    (text, part) =>
      text.replace(
        new RegExp(
          `(?<![\\p{L}])${part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}])`,
          "gu",
        ),
        "[name]",
      ),
    redacted,
  );
}

export function matchRequest(resume: string, posting: string) {
  const score = (instructions: string, dimension: Dimension) => ({
    type: "score",
    instructions,
    criteria: LEVELS[dimension],
  });
  return {
    model: "clef",
    state: { resume: redact(resume), job_posting: posting },
    questions: {
      skills: score(
        "How many of the skills and tools the job posting requires does the resume show?",
        "skills",
      ),
      experience: score(
        "How well do the years and level of experience in the resume match what the job posting asks for?",
        "experience",
      ),
      domain: score(
        "How closely does the past work in the resume match the work this role does?",
        "domain",
      ),
      hard_requirements: {
        type: "noul",
        instructions:
          "Does the resume meet every hard requirement the job posting states, such as a required degree, license, certification, security clearance or location? Answer yes when the posting states none.",
      },
    },
  };
}

const inRange = (value: unknown, max: number): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= max;

export function combine({ answers }: ClefResponse): JobMatch {
  const dimensions = Object.keys(LEVELS) as Dimension[];
  if (
    !dimensions.every((dimension) =>
      inRange(answers?.[dimension]?.score, LEVELS[dimension].length - 1),
    ) ||
    !inRange(answers?.hard_requirements?.noul, 1)
  )
    throw new Error("Clef returned an answer outside the expected range.");
  const percent = (dimension: Dimension) =>
    answers[dimension].score / (LEVELS[dimension].length - 1);
  const weighted = (Object.keys(WEIGHTS) as Dimension[]).reduce(
    (sum, dimension) => sum + WEIGHTS[dimension] * percent(dimension),
    0,
  );
  const hard = answers.hard_requirements.noul;
  const confidences = (Object.keys(LEVELS) as Dimension[])
    .map((dimension) => answers[dimension].confidence)
    .filter((value): value is number => value !== null);
  return {
    match: Math.round(100 * weighted * (0.5 + 0.5 * hard)),
    skills: Math.round(100 * percent("skills")),
    experience: Math.round(100 * percent("experience")),
    domain: Math.round(100 * percent("domain")),
    meetsHardRequirements: Math.round(100 * hard),
    confidence: confidences.length ? Math.min(...confidences) : null,
  };
}

export async function askClef(ai: Ai, resume: string, posting: string) {
  try {
    const response = (await ai.run(
      MATCH_MODEL as never,
      matchRequest(resume, posting) as never,
    )) as unknown as ClefResponse;
    return { match: combine(response) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ clefError: message.slice(0, 200) }));
    return {
      error: /4006|neurons/i.test(message)
        ? ("allowance" as const)
        : ("failed" as const),
    };
  }
}
