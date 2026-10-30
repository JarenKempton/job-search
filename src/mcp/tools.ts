import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  benefitsPatchSchema,
  benefitsSchema,
} from "../applications/benefits.ts";
import {
  APPLY_METHODS,
  EMPLOYMENT_TYPES,
  EVENT_KINDS,
  REQUIREMENTS,
  SOURCES,
  STATUSES,
  WORK_MODES,
} from "../applications/fields.ts";

export type ApiCall = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<unknown>;

export async function unwrap(response: Response): Promise<unknown> {
  const payload = (await response.json().catch(() => ({}))) as {
    data?: unknown;
    error?: { message?: string };
  };
  if (!response.ok)
    throw new Error(
      payload.error?.message ?? `Request failed (${response.status}).`,
    );
  return payload.data;
}

function reply(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe("YYYY-MM-DD");

const fields = {
  company: z.string().min(1),
  role: z.string().min(1),
  jobUrl: z.string().url().optional(),
  location: z.string().optional(),
  workMode: z.enum(WORK_MODES).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES).optional(),
  source: z.enum(SOURCES).optional().describe("Where the job was found"),
  sourceDetail: z
    .string()
    .optional()
    .describe("Referrer, recruiter, or list name"),
  applyMethod: z.enum(APPLY_METHODS).optional(),
  requirements: z
    .array(z.enum(REQUIREMENTS))
    .optional()
    .describe("What the application asks for"),
  resumeVersion: z.string().optional(),
  salaryMin: z.number().int().optional().describe("USD per year"),
  salaryMax: z.number().int().optional().describe("USD per year"),
  yearsRequired: z.number().int().min(0).max(50).optional(),
  fit: z
    .number()
    .int()
    .min(0)
    .max(100)
    .optional()
    .describe(
      "How well the applicant matches the posting, 0-100. Prefer score_jobs, which sets this from a decision model; never estimate it yourself.",
    ),
  interest: z.number().int().min(1).max(5).optional(),
  status: z
    .enum(STATUSES)
    .optional()
    .describe(
      "Changing status auto-fills applied/heard-back dates and logs it",
    ),
  appliedOn: day.optional(),
  heardBackOn: day.optional(),
  followUpOn: day.optional(),
  skipFollowUp: z
    .boolean()
    .optional()
    .describe(
      "True when the applicant doesn't plan to follow up, which stops follow-up reminders. Setting followUpOn turns reminders back on.",
    ),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  description: z.string().optional().describe("Full job description text"),
  notes: z.string().optional(),
  pto: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Vacation allowance or unlimited PTO, accrual, and rollover rules. Omit when unknown; null clears the field.",
    ),
  sickLeave: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Paid sick days and any separate sick-leave policy. Omit when unknown; null clears the field.",
    ),
  holidays: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Paid holidays, floating holidays, and shutdowns. Omit when unknown; null clears the field.",
    ),
  healthcare: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Medical, dental, and vision; employee premiums, deductible, and when coverage starts. Omit when unknown; null clears the field.",
    ),
  retirement: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "401(k) or pension, employer match, and vesting schedule. Omit when unknown; null clears the field.",
    ),
  parentalLeave: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Paid or unpaid leave and eligibility. Omit when unknown; null clears the field.",
    ),
  otherBenefits: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Disability coverage, education budget, equipment, stipends, and other perks. Omit when unknown; null clears the field.",
    ),
  benefitsNotes: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Questions, caveats, and details still to confirm. Omit when unknown; null clears the field.",
    ),
  benefits: benefitsSchema
    .nullable()
    .optional()
    .describe(
      "Verified structured benefits. Money is integer cents plus currency; unknown facts are omitted or null, never assumed zero. Keep legacy policy text as source notes.",
    ),
  benefitsSource: z
    .string()
    .trim()
    .max(5_000)
    .nullable()
    .optional()
    .describe(
      "Posting URL, benefits document, or recruiter and date. Omit when unknown; null clears the field.",
    ),
};

const ALWAYS_SET = new Set(["company", "role", "status", "requirements"]);

export function jobSearchServer(call: ApiCall, today: () => string) {
  const server = new McpServer({ name: "job-search", version: "0.1.0" });

  server.registerTool(
    "list_applications",
    {
      description:
        "List tracked job applications, optionally filtered by status or a search over company/role. Returns compact rows with ids.",
      annotations: { readOnlyHint: true },
      inputSchema: {
        status: z.enum(STATUSES).optional(),
        search: z.string().optional(),
      },
    },
    async ({ status, search }) => {
      const rows = (await call("/api/v1/applications")) as Array<
        Record<string, unknown>
      >;
      const needle = search?.toLowerCase();
      return reply(
        rows
          .filter((row) => !status || row.status === status)
          .filter(
            (row) =>
              !needle ||
              `${row.company} ${row.role}`.toLowerCase().includes(needle),
          )
          .map(
            ({
              id,
              company,
              role,
              status,
              source,
              appliedOn,
              heardBackOn,
              followUpOn,
              fit,
              salaryMin,
              salaryMax,
            }) => ({
              id,
              company,
              role,
              status,
              source,
              appliedOn,
              heardBackOn,
              followUpOn,
              fit,
              salaryMin,
              salaryMax,
            }),
          ),
      );
    },
  );

  server.registerTool(
    "get_application",
    {
      description: "Get one application with every field and its timeline.",
      annotations: { readOnlyHint: true },
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => reply(await call(`/api/v1/applications/${id}`)),
  );

  server.registerTool(
    "add_application",
    {
      description:
        "Track a new job. Before calling, check list_applications for a duplicate. When given a posting URL, read the posting first and fill in as many fields as it supports. Status defaults to saved; use applied if the applicant already applied. Include benefits supported by the posting; leave unknown benefits unset.",
      inputSchema: fields,
    },
    async (input) =>
      reply(
        await call("/api/v1/applications", "POST", {
          ...input,
          today: today(),
        }),
      ),
  );

  server.registerTool(
    "update_application",
    {
      description:
        "Change fields on an existing application. Send only the fields that change. Send null to clear a field you cannot verify, such as an applied date with no confirmation email.",
      inputSchema: {
        id: z.string().uuid(),
        ...Object.fromEntries(
          Object.entries(fields).map(([key, schema]) => [
            key,
            ALWAYS_SET.has(key)
              ? schema.optional()
              : schema.nullable().optional(),
          ]),
        ),
        benefits: benefitsPatchSchema
          .nullable()
          .optional()
          .describe(
            "Nested patch: omitted groups and facts are preserved; null clears a fact, group, or all benefits. Money objects merge by field; arrays replace in full. Setting not_offered clears prior policy facts and rejects contradictory supplied facts. Unlimited PTO and sick leave included in PTO clear the prior separate annual allowance.",
          ),
      },
    },
    async ({ id, ...input }) =>
      reply(
        await call(`/api/v1/applications/${id}`, "PATCH", {
          ...input,
          today: today(),
        }),
      ),
  );

  server.registerTool(
    "log_event",
    {
      description:
        "Add a timeline entry: a reply, call, interview, take-home, follow-up sent, offer, or note. Pair with update_application when the status changes. For an email, put who it's from on the first line of note, then the email text without signatures, footers or quoted earlier messages. For follow_up, put who was contacted and the message in note; the next follow-up reminder moves to 14 days after occurredOn.",
      inputSchema: {
        id: z.string().uuid(),
        kind: z.enum(
          EVENT_KINDS.filter((kind) => kind !== "status") as [
            string,
            ...string[],
          ],
        ),
        occurredOn: day.optional().describe("Defaults to today"),
        note: z
          .string()
          .max(5_000)
          .optional()
          .describe("Details, or the message text for emails and follow-ups"),
      },
    },
    async ({ id, kind, occurredOn, note }) =>
      reply(
        await call(`/api/v1/applications/${id}/events`, "POST", {
          kind,
          occurredOn: occurredOn ?? today(),
          note: note ?? null,
        }),
      ),
  );

  server.registerTool(
    "delete_application",
    {
      description:
        "Permanently delete an application and its timeline, e.g. a duplicate row. Before deleting a duplicate, move anything worth keeping onto the surviving application with update_application and log_event.",
      annotations: { destructiveHint: true },
      inputSchema: { id: z.string().uuid() },
    },
    async ({ id }) => reply(await call(`/api/v1/applications/${id}`, "DELETE")),
  );

  server.registerTool(
    "get_resume",
    {
      description:
        "Get the applicant's saved resume text, or null when none is saved. Use it to judge fit, tailor answers, or compare against a posting.",
      annotations: { readOnlyHint: true },
      inputSchema: {},
    },
    async () => reply(await call("/api/v1/resume")),
  );

  server.registerTool(
    "save_resume",
    {
      description:
        "Replace the applicant's saved resume with plain text the applicant provided. Only call this when the applicant asks to save or update their resume; it overwrites the previous version.",
      annotations: { idempotentHint: true },
      inputSchema: {
        text: z.string().min(1).describe("Full resume as plain text"),
        fileName: z.string().optional().describe("Original file name, if any"),
      },
    },
    async ({ text, fileName }) =>
      reply(
        await call("/api/v1/resume", "PUT", {
          text,
          fileName: fileName ?? null,
        }),
      ),
  );

  server.registerTool(
    "score_jobs",
    {
      description:
        "Score how well the applicant's saved resume matches up to 10 job postings at once, 0-100 each, using Cloudflare's Clef decision model. Each result has a rating: strong (60+), partial (40-59) or stretch (under 40), plus the skills, experience, domain and hard-requirements parts, and the met, missing and unclear requirements when you pass them. When looking for jobs, score every posting you find instead of filtering by your own judgment, then search for more jobs like the highest scorers using their titles and the skills that matched (the skills, experience and domain parts show why). Scoring doesn't add anything to the tracker; only add jobs the applicant picks. Pass applicationId to save a score as that application's resume match. Contact details are removed from the resume first. Scores are limited per day and the applicant can turn them off on the Resume page; the result says how many are used.",
      annotations: { openWorldHint: true },
      inputSchema: {
        jobs: z
          .array(
            z.object({
              label: z
                .string()
                .min(1)
                .describe("Company and role, to match results to postings"),
              posting: z
                .string()
                .min(400)
                .max(30_000)
                .describe(
                  "The full job posting text as published, not a summary: role, responsibilities, requirements, location. Leave out page navigation and legal boilerplate. Saved as the application's description when applicationId is given.",
                ),
              requirements: z
                .array(z.string().min(1).max(120))
                .max(15)
                .optional()
                .describe(
                  "The posting's key requirements, each spelled out in plain words rather than abbreviations, e.g. 'Go', '5+ years of professional experience', 'Bachelor's degree in Computer Science', 'Terraform'. The result lists which ones the resume clearly meets, which are clearly missing, and which are unclear.",
                ),
              applicationId: z
                .string()
                .uuid()
                .optional()
                .describe("Save the score as this application's resume match"),
            }),
          )
          .min(1)
          .max(10),
      },
    },
    async ({ jobs }) =>
      reply(
        await call("/api/v1/match-scores", "POST", { jobs, today: today() }),
      ),
  );

  return server;
}
