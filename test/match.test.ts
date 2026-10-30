import { env, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { combine, DAILY_SCORES, MATCH_MODEL, redact } from "../src/match";
import { call, data, rpc } from "./helpers";

const RESUME = `Alex Rivera
alex.rivera@example.com · (512) 555-0142 · linkedin.com/in/alexrivera · https://alex.dev
Product Engineer, 2019 - 2023 and 2023-2026
Skills: TypeScript, React, Node.js, PostgreSQL`;

const POSTING = `Senior TypeScript Engineer (Remote, US)
You'll build product features end to end in React and TypeScript, design Node.js services on PostgreSQL, and work closely with design and support to ship small releases every week.
Requirements: 5+ years of professional software engineering; strong React, TypeScript and Node.js; production PostgreSQL experience; comfort owning features from database to UI.
Nice to have: experience building AI tooling, MCP servers or developer platforms.`;

const ANSWERS = {
  model: "clef",
  answers: {
    skills: { type: "score", score: 3, confidence: 0.9 },
    experience: { type: "score", score: 2, confidence: 0.6 },
    domain: { type: "score", score: 1.5, confidence: 0.8 },
    hard_requirements: { type: "noul", noul: 1 },
  },
  usage: { input_tokens: 420, output_tokens: 0 },
};

const tracker = () =>
  env.TRACKER.get(env.TRACKER.idFromName("jaren@example.test"));

async function clefReturns(
  answer: (input: { questions: Record<string, unknown> }) => unknown,
) {
  const run = vi.fn(
    async (_model: string, input: { questions: Record<string, unknown> }) =>
      answer(input),
  );
  await runInDurableObject(tracker(), (instance) => {
    const self = instance as unknown as { env: Record<string, unknown> };
    self.env = { ...self.env, AI: { run } };
  });
  return run;
}

const answers = () =>
  clefReturns(({ questions }) => ({
    ...ANSWERS,
    answers: {
      ...ANSWERS.answers,
      ...Object.fromEntries(
        Object.keys(questions)
          .filter((key) => key.startsWith("requirement_"))
          .map((key, index) => [
            key,
            { type: "noul", noul: [0.9, 0.1, 0.5][index % 3] },
          ]),
      ),
    },
  }));

async function turnOn(ctx?: ExecutionContext) {
  await call("/api/v1/resume", { method: "PUT", json: { text: RESUME } }, ctx);
  return call(
    "/api/v1/match-scores/settings",
    { method: "PUT", json: { enabled: true } },
    ctx,
  );
}

type Job = {
  label?: string;
  posting?: string;
  requirements?: string[];
  applicationId?: string;
};

const score = (jobs: Job[] = [{}], today?: string, ctx?: ExecutionContext) =>
  call(
    "/api/v1/match-scores",
    {
      method: "POST",
      json: {
        jobs: jobs.map((job, index) => ({
          label: `Job ${index + 1}`,
          posting: POSTING,
          ...job,
        })),
        today,
      },
    },
    ctx,
  );

type Scored = {
  results: Array<{ label: string; match?: number; error?: string }>;
  usedToday: number;
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("match scores", () => {
  it("removes contact details but keeps dates", () => {
    const redacted = redact(RESUME);
    expect(redacted).not.toMatch(
      /Alex Rivera|example\.com|555|linkedin|alex\.dev/,
    );
    expect(redacted).toContain("[name]");
    expect(redacted).toContain("2019 - 2023 and 2023-2026");
    expect(redacted).toContain("TypeScript, React");
  });

  it.each([
    ["# Alex Rivera\nalex@x.com", "# [name]\n[email]"],
    ["Alex Rivera, PMP\nSkills", "[name], PMP\nSkills"],
    [
      "Alex Rivera | (512) 555-0142 | alexrivera.net/work | alex.dev | @alexrivera\n123 Main St, Austin TX",
      "[name] | [phone] | [link] | [link] | [handle]\n[address], Austin TX",
    ],
    ["Summary\nBuilt things", "Summary\nBuilt things"],
    ["Alex Rivera\nReference: Alex Rivera", "[name]\nReference: [name]"],
    ["Jane Doe\n+44 20 7946 0958", "[name]\n[phone]"],
    [
      "Jane Doe\nSkills: Socket.io/Redis, Amazon.com/Alexa",
      "[name]\nSkills: Socket.io/Redis, Amazon.com/Alexa",
    ],
    ["Jane Doe\n(see https://alex.dev), more", "[name]\n(see [link]), more"],
    [
      "Jane Doe\n2015-2018-2020, 2018 – 2020, 2019 - 2023",
      "[name]\n2015-2018-2020, 2018 – 2020, 2019 - 2023",
    ],
  ])("redacts %j", (input, expected) => {
    expect(redact(input)).toBe(expected);
  });

  it("weights the parts in code and takes off at most a quarter when hard requirements fail", () => {
    const met = combine(ANSWERS as never);
    expect(met).toMatchObject({
      skills: 100,
      experience: 67,
      domain: 50,
      meetsHardRequirements: 100,
      met: [],
      missing: [],
      unclear: [],
    });
    expect(met.match).toBe(
      Math.round(100 * (0.45 + 0.3 * (2 / 3) + 0.25 * 0.5)),
    );
    const missed = combine({
      ...ANSWERS,
      answers: { ...ANSWERS.answers, hard_requirements: { noul: 0 } },
    } as never);
    expect(missed.match).toBe(
      Math.round(100 * (0.45 + 0.3 * (2 / 3) + 0.25 * 0.5) * 0.75),
    );
  });

  it("is on by default, needs a resume, and refuses once turned off", async () => {
    const clef = await answers();
    expect(await data(await call("/api/v1/match-scores/settings"))).toEqual({
      enabled: true,
      usedToday: 0,
      dailyLimit: DAILY_SCORES,
    });
    expect((await score()).status).toBe(409);
    await call("/api/v1/match-scores/settings", {
      method: "PUT",
      json: { enabled: false },
    });
    expect((await score()).status).toBe(403);
    expect(clef).not.toHaveBeenCalled();
  });

  it("sends the redacted resume to Clef and saves the match on the application", async () => {
    const clef = await answers();
    await turnOn();
    const { id } = await data<{ id: string }>(
      await call("/api/v1/applications", {
        method: "POST",
        json: {
          company: "Acme",
          role: "Engineer",
          status: "saved",
          requirements: [],
        },
      }),
    );
    const result = await data<Scored>(await score([{ applicationId: id }]));
    expect(result).toMatchObject({ usedToday: 1, dailyLimit: DAILY_SCORES });
    const [model, input] = clef.mock.calls[0] as unknown as [
      string,
      { model: string; state: { resume: string; job_posting: string } },
    ];
    expect(model).toBe(MATCH_MODEL);
    expect(input.model).toBe("clef");
    expect(input.state.job_posting).toBe(POSTING);
    expect(input.state.resume).not.toMatch(/example\.com|555/);
    expect(
      (await data<{ fit: number }>(await call(`/api/v1/applications/${id}`)))
        .fit,
    ).toBe(result.results[0].match);
  });

  it("stops at the daily limit, even if the client sends another date", async () => {
    const clef = await answers();
    await turnOn();
    await runInDurableObject(tracker(), (_, state) => {
      const saved = state.storage.kv.get<{ day: string }>("matchScores")!;
      state.storage.kv.put("matchScores", { ...saved, used: DAILY_SCORES });
    });
    const limited = await score([{}], "2001-01-01");
    expect(limited.status).toBe(429);
    expect(clef).not.toHaveBeenCalled();
  });

  it("scores a batch up to what's left today and says which ones ran out", async () => {
    const clef = await answers();
    await turnOn();
    await runInDurableObject(tracker(), (_, state) => {
      const saved = state.storage.kv.get<{ day: string }>("matchScores")!;
      state.storage.kv.put("matchScores", { ...saved, used: DAILY_SCORES - 2 });
    });
    const { results, usedToday } = await data<Scored>(
      await score([
        {},
        { applicationId: "6f1c2c8e-8a4b-4f7e-9d1a-2b3c4d5e6f70" },
        {},
        {},
      ]),
    );
    expect(clef).toHaveBeenCalledTimes(2);
    expect(usedToday).toBe(DAILY_SCORES);
    expect(results.map((result) => result.label)).toEqual([
      "Job 1",
      "Job 2",
      "Job 3",
      "Job 4",
    ]);
    expect(results[0].match).toBeTypeOf("number");
    expect(results[1].error).toMatch(/Application not found/);
    expect(results[2].match).toBeTypeOf("number");
    expect(results[3].error).toMatch(
      /ran out.*Don't estimate a match yourself/,
    );
  });

  it("treats an out-of-range answer as a failure: not saved, not counted", async () => {
    await clefReturns(() => ({
      answers: { ...ANSWERS.answers, skills: { score: null, confidence: 0.5 } },
    }));
    await turnOn();
    const { id } = await data<{ id: string }>(
      await call("/api/v1/applications", {
        method: "POST",
        json: {
          company: "Acme",
          role: "Engineer",
          status: "saved",
          requirements: [],
          fit: 40,
        },
      }),
    );
    const { results, usedToday } = await data<Scored>(
      await score([{ applicationId: id }]),
    );
    expect(results[0].error).toMatch(/couldn't be scored/);
    expect(usedToday).toBe(0);
    expect(
      (await data<{ fit: number }>(await call(`/api/v1/applications/${id}`)))
        .fit,
    ).toBe(40);
  });

  it("sorts requirements into met, missing and unclear", async () => {
    const clef = await answers();
    await turnOn();
    const requirements = ["TypeScript", "Go", "Degree", "React"];
    const { results } = await data<{
      results: Array<{ met: string[]; missing: string[]; unclear: string[] }>;
    }>(await score([{ requirements }]));
    expect(results[0]).toMatchObject({
      met: ["TypeScript", "React"],
      missing: ["Go"],
      unclear: ["Degree"],
    });
    const [, input] = clef.mock.calls[0] as unknown as [
      string,
      { questions: Record<string, { instructions: string }> },
    ];
    expect(input.questions.requirement_1.instructions).toBe(
      "Does the resume show: Go?",
    );
    await score([{ requirements: ["TypeScript"] }]);
    expect(clef).toHaveBeenCalledTimes(2);
  });

  it("rates scores and rejects a summary instead of the full posting", async () => {
    await answers();
    await turnOn();
    const { results } = await data<
      Scored & { results: Array<{ rating: string }> }
    >(await score());
    expect(results[0].rating).toBe("strong");
    expect(
      (
        await score([
          { posting: "Short summary of a TypeScript role. ".repeat(3) },
        ])
      ).status,
    ).toBe(422);
  });

  it("re-scores the same posting for free and saves the score, breakdown and posting", async () => {
    const clef = await answers();
    await turnOn();
    const first = await data<Scored>(await score());
    const { id } = await data<{ id: string }>(
      await call("/api/v1/applications", {
        method: "POST",
        json: {
          company: "Acme",
          role: "Engineer",
          status: "saved",
          requirements: [],
          description: "Short summary.",
        },
      }),
    );
    const second = await data<Scored>(await score([{ applicationId: id }]));
    expect(clef).toHaveBeenCalledTimes(1);
    expect(second.usedToday).toBe(first.usedToday);
    const saved = await data<{
      fit: number;
      fitDetails: { skills: number; scoredAt: string } | null;
      description: string;
    }>(await call(`/api/v1/applications/${id}`));
    expect(saved.fit).toBe(first.results[0].match);
    expect(saved.fitDetails).toMatchObject({ skills: 100 });
    expect(saved.description).toBe(POSTING);
    await call(`/api/v1/applications/${id}`, {
      method: "PATCH",
      json: { fit: 30 },
    });
    expect(
      (
        await data<{ fitDetails: unknown }>(
          await call(`/api/v1/applications/${id}`),
        )
      ).fitDetails,
    ).toBeNull();
  });

  it("tells the AI when the shared free allowance is used up, and doesn't count it", async () => {
    await clefReturns(() => {
      throw new Error(
        "4006: you have used up your daily free allocation of 10,000 neurons",
      );
    });
    await turnOn();
    const { results } = await data<Scored>(await score());
    expect(results[0].error).toMatch(
      /shared allowance.*Don't call score_jobs again today/,
    );
    expect(
      await data(await call("/api/v1/match-scores/settings")),
    ).toMatchObject({
      usedToday: 0,
    });
  });

  it("tells the AI what to do when scores are off, instead of a bare failure", async () => {
    const clef = await answers();
    await turnOn();
    await call("/api/v1/match-scores/settings", {
      method: "PUT",
      json: { enabled: false },
    });
    const result = (await rpc("tools/call", {
      name: "score_jobs",
      arguments: { jobs: [{ label: "Acme engineer", posting: POSTING }] },
    })) as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Don't call score_jobs again/);
    expect(result.content[0].text).toMatch(/Don't estimate a match yourself/);
    expect(clef).not.toHaveBeenCalled();
  });

  it("scores through the MCP tool", async () => {
    await answers();
    await turnOn();
    const result = (await rpc("tools/call", {
      name: "score_jobs",
      arguments: { jobs: [{ label: "Acme engineer", posting: POSTING }] },
    })) as { content: Array<{ text: string }> };
    expect(JSON.parse(result.content[0].text)).toMatchObject({ usedToday: 1 });
  });
});
