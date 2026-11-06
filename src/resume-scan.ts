import { z } from "zod";
import type { Finding } from "./applications/validation";
import {
  EMAIL,
  INTL_PHONE,
  MATCH_GATEWAY,
  nameIn,
  PROFILE,
  redact,
  SITE,
  US_PHONE,
} from "./match";

export const DAILY_SCANS = 5;
export const SCAN_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8-fast";

const HEADER_LINES = 8;
const REGIONS =
  "AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|PR|AB|BC|MB|NB|NL|NS|ON|PE|QC|SK";
const CITY_STATE = new RegExp(
  `\\b[A-Z][a-zA-Z.'-]+(?: [A-Z][a-zA-Z.'-]+){0,3}, ?(?:${REGIONS})\\b`,
);
const REMOTE = /\bremote\b/i;

const HEADINGS = new Set(
  [
    "summary",
    "professional summary",
    "profile",
    "objective",
    "about",
    "about me",
    "experience",
    "work experience",
    "professional experience",
    "relevant experience",
    "employment",
    "employment history",
    "work history",
    "career history",
    "education",
    "education and training",
    "skills",
    "technical skills",
    "core skills",
    "key skills",
    "core competencies",
    "skills and abilities",
    "projects",
    "personal projects",
    "selected projects",
    "certifications",
    "licenses and certifications",
    "certificates",
    "awards",
    "honors",
    "honors and awards",
    "achievements",
    "publications",
    "volunteer experience",
    "volunteering",
    "leadership",
    "activities",
    "languages",
    "interests",
    "training",
    "courses",
    "coursework",
    "relevant coursework",
    "references",
    "military service",
  ].map((heading) => heading.replace(/ and /g, " & ")),
);

const extracted = z.object({
  jobs: z
    .array(
      z.object({
        company: z.string(),
        title: z.string(),
        start: z.string(),
        end: z.string(),
      }),
    )
    .max(30),
  education: z
    .array(
      z.object({ school: z.string(), degree: z.string(), end: z.string() }),
    )
    .max(10),
  skills: z.array(z.string()).max(200),
});

type Extracted = z.infer<typeof extracted>;

export type ResumeScan = Extracted & {
  contact: {
    name: string | null;
    email: string | null;
    phone: string | null;
    location: string | null;
    links: string[];
  };
  sections: string[];
  findings: Finding[];
  scannedAt: string;
};

const SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          company: { type: "string" },
          title: { type: "string" },
          start: { type: "string" },
          end: { type: "string" },
        },
        required: ["company", "title", "start", "end"],
      },
    },
    education: {
      type: "array",
      items: {
        type: "object",
        properties: {
          school: { type: "string" },
          degree: { type: "string" },
          end: { type: "string" },
        },
        required: ["school", "degree", "end"],
      },
    },
    skills: { type: "array", items: { type: "string" } },
  },
  required: ["jobs", "education", "skills"],
};

const INSTRUCTIONS = `You are the resume parser inside an applicant tracking system. Read the resume and fill in the fields exactly as written.
- jobs: one entry per job title held, newest first. A second title at the same company is its own entry. company and title are copied from the resume. start and end are the dates as written, or "" when the resume gives none. Use "Present" only when the resume says so.
- education: one entry per school, with the degree and end date as written, or "" when missing.
- skills: each individual skill, tool or technology the resume lists, one per item.
Leave a field "" or a list empty when the resume doesn't state it. Never guess, infer or fix anything.`;

export function scanRequest(resume: string) {
  return {
    messages: [
      { role: "system", content: INSTRUCTIONS },
      { role: "user", content: redact(resume) },
    ],
    response_format: { type: "json_schema", json_schema: SCHEMA },
    max_tokens: 2_000,
    temperature: 0,
  };
}

const plain = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, "");
const first = (text: string, pattern: RegExp) =>
  text.match(pattern)?.[0]?.trim() ?? null;

export function readContact(resume: string): ResumeScan["contact"] {
  const lines = resume.split("\n").filter((line) => line.trim());
  const header = lines.slice(0, HEADER_LINES).join("\n");
  const location =
    header
      .split("\n")
      .map((line) => first(line, CITY_STATE))
      .find(Boolean) ?? null;
  const links = [
    ...new Set([
      ...(header.match(PROFILE) ?? []),
      ...(header.replace(EMAIL, "").match(SITE) ?? []),
    ]),
  ].map((link) => link.replace(/[|,.]+$/, ""));
  return {
    name: lines[0] ? nameIn(lines[0]) : null,
    email: first(resume, EMAIL),
    phone: first(resume, INTL_PHONE) ?? first(resume, US_PHONE),
    location: location ?? (REMOTE.test(header) ? "Remote" : null),
    links: [...new Set(links)],
  };
}

const headingText = (line: string) =>
  line
    .trim()
    .replace(/:$/, "")
    .toLowerCase()
    .replace(/ and /g, " & ")
    .replace(/\s+/g, " ");

export function readSections(resume: string) {
  const lines = resume.split("\n").map((line) => line.trim());
  const known: string[] = [];
  const unusual: string[] = [];
  lines.forEach((line, index) => {
    if (!index || !line || line.length > 40) return;
    const name = headingText(line);
    if (HEADINGS.has(name)) known.push(line.replace(/:$/, ""));
    else if (/^[A-Z][A-Z &/,-]{2,}$/.test(line) && !/[|@]/.test(line))
      unusual.push(line);
  });
  return { known, unusual };
}

function verified(resume: string, found: Extracted): Extracted {
  const text = plain(resume);
  const appears = (value: string) => !value || text.includes(plain(value));
  return {
    jobs: found.jobs.filter(
      (job) =>
        (job.company || job.title) &&
        appears(job.company) &&
        appears(job.title),
    ),
    education: found.education.filter(
      (school) => school.school && appears(school.school),
    ),
    skills: [
      ...new Set(found.skills.filter((skill) => skill && appears(skill))),
    ],
  };
}

function findingsFor(
  contact: ResumeScan["contact"],
  sections: ReturnType<typeof readSections>,
  found: Extracted,
): Finding[] {
  const findings: Finding[] = [];
  const add = (
    severity: Finding["severity"],
    title: string,
    detail: string,
    example: string | null = null,
  ) => findings.push({ severity, title, detail, example });

  if (!contact.email)
    add(
      "fix",
      "No email address found",
      "Put your email in the header as plain text, not inside an image or a link label.",
    );
  if (!contact.phone)
    add(
      "fix",
      "No phone number found",
      "Put your phone number in the header as plain text, like (555) 555-0100.",
    );
  if (!contact.location)
    add(
      "consider",
      "No city and state found",
      "Many ATS filters search by location. Add City, ST near the top, even if you want remote work.",
    );
  if (!contact.links.some((link) => /linkedin\.com/i.test(link)))
    add(
      "consider",
      "No LinkedIn URL found",
      "Recruiters often look you up from the ATS record. Write the full linkedin.com/in/… address, not just the word LinkedIn.",
    );
  if (!found.jobs.length)
    add(
      "fix",
      "No jobs were read",
      "The parser couldn't find any company and title. Use an Experience heading and put each company, title and dates on their own lines.",
    );
  for (const job of found.jobs) {
    const label = [job.title, job.company].filter(Boolean).join(" at ");
    if (!job.company)
      add(
        "fix",
        `No company read for ${label}`,
        "Put the company name on its own line above the title.",
      );
    if (!job.title)
      add(
        "fix",
        `No job title read at ${label}`,
        "Put the job title on its own line under the company.",
      );
    if (!job.start || !job.end)
      add(
        "fix",
        `No dates read for ${label}`,
        "Write start and end dates as Mon YYYY – Mon YYYY (or Present) next to each title.",
      );
  }
  if (!found.education.length)
    add(
      "consider",
      "No education read",
      "Some ATS screens require an Education section. If you have a degree, certificate or bootcamp, add one.",
    );
  if (found.skills.length < 8)
    add(
      "consider",
      `Only ${found.skills.length} skills read`,
      "ATS keyword search matches individual skills. List them in a Skills section, separated by commas.",
    );
  for (const heading of sections.unusual)
    add(
      "consider",
      `Unusual section heading "${heading}"`,
      "Parsers look for standard headings like Experience, Education, Skills and Projects. Content under other headings can be dropped or merged into the section above.",
      heading,
    );
  return findings;
}

export function buildScan(resume: string, found: Extracted): ResumeScan {
  const contact = readContact(resume);
  const sections = readSections(resume);
  const checked = verified(resume, found);
  return {
    contact,
    ...checked,
    sections: sections.known,
    findings: findingsFor(contact, sections, checked),
    scannedAt: new Date().toISOString(),
  };
}

export async function askScanner(ai: Ai, resume: string) {
  try {
    const response = (await ai.run(
      SCAN_MODEL as never,
      scanRequest(resume) as never,
      { gateway: { id: MATCH_GATEWAY } },
    )) as unknown as {
      response?: unknown;
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const answer =
      response?.response ?? response?.choices?.[0]?.message?.content;
    const raw = typeof answer === "string" ? JSON.parse(answer) : answer;
    return { scan: buildScan(resume, extracted.parse(raw)) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ scanError: message.slice(0, 200) }));
    return {
      error: /4006|2045|neurons|spend limit/i.test(message)
        ? ("allowance" as const)
        : ("failed" as const),
    };
  }
}
