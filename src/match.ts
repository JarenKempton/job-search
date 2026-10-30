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

export function redact(resume: string) {
  const lines = resume.split("\n");
  const first = lines.findIndex((line) => line.trim());
  if (first >= 0 && /^[\p{L} .'-]{2,60}$/u.test(lines[first].trim()))
    lines[first] = "[name]";
  return lines
    .join("\n")
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, "[email]")
    .replace(
      /\b(https?:\/\/|www\.)\S+|\b[\w-]+\.(com|io|dev|me)\/\S*/gi,
      "[link]",
    )
    .replace(
      /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
      "[phone]",
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

export function combine({ answers }: ClefResponse): JobMatch {
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
      error: /neuron|4006|daily/i.test(message)
        ? ("allowance" as const)
        : ("failed" as const),
    };
  }
}
