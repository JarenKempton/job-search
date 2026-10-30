import { env, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { combine, MATCH_MODEL, redact } from "../src/match";
import { call, data, rpc } from "./helpers";

const RESUME = `Alex Rivera
alex.rivera@example.com · (512) 555-0142 · linkedin.com/in/alexrivera · https://alex.dev
Product Engineer, 2019 - 2023 and 2023-2026
Skills: TypeScript, React, Node.js, PostgreSQL`;

const POSTING =
  "Senior TypeScript engineer. Requires 5+ years with React and Node.js, PostgreSQL experience, remote in the US.";

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

async function clefReturns(answer: () => unknown) {
  const run = vi.fn(async () => answer());
  await runInDurableObject(tracker(), (instance) => {
    const self = instance as unknown as { env: Record<string, unknown> };
    self.env = { ...self.env, AI: { run } };
  });
  return run;
}

const answers = () => clefReturns(() => ANSWERS);

async function turnOn(ctx?: ExecutionContext) {
  await call("/api/v1/resume", { method: "PUT", json: { text: RESUME } }, ctx);
  return call(
    "/api/v1/match-scores/settings",
    { method: "PUT", json: { enabled: true } },
    ctx,
  );
}

const score = (json: Record<string, unknown>, ctx?: ExecutionContext) =>
  call("/api/v1/match-scores", { method: "POST", json }, ctx);

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

  it("weights the parts in code and halves the match when hard requirements fail", () => {
    const met = combine(ANSWERS as never);
    expect(met).toMatchObject({
      skills: 100,
      experience: 67,
      domain: 50,
      meetsHardRequirements: 100,
      confidence: 0.6,
    });
    expect(met.match).toBe(
      Math.round(100 * (0.45 + 0.3 * (2 / 3) + 0.25 * 0.5)),
    );
    const missed = combine({
      ...ANSWERS,
      answers: { ...ANSWERS.answers, hard_requirements: { noul: 0 } },
    } as never);
    expect(missed.match).toBe(Math.round(met.match / 2));
  });

  it("is on by default, needs a resume, and refuses once turned off", async () => {
    const clef = await answers();
    expect(await data(await call("/api/v1/match-scores/settings"))).toEqual({
      enabled: true,
      usedToday: 0,
      dailyLimit: 25,
    });
    expect((await score({ posting: POSTING })).status).toBe(409);
    await call("/api/v1/match-scores/settings", {
      method: "PUT",
      json: { enabled: false },
    });
    expect((await score({ posting: POSTING })).status).toBe(403);
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
    const result = await data<{ match: number }>(
      await score({ posting: POSTING, applicationId: id }),
    );
    expect(result).toMatchObject({ usedToday: 1, dailyLimit: 25 });
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
    ).toBe(result.match);
  });

  it("stops at the daily limit, even if the client sends another date", async () => {
    const clef = await answers();
    await turnOn();
    await runInDurableObject(tracker(), (_, state) => {
      const saved = state.storage.kv.get<{ day: string }>("matchScores")!;
      state.storage.kv.put("matchScores", { ...saved, used: 25 });
    });
    const limited = await score({ posting: POSTING, today: "2001-01-01" });
    expect(limited.status).toBe(429);
    expect(clef).not.toHaveBeenCalled();
  });

  it("tells the AI when the shared free allowance is used up, and doesn't count it", async () => {
    await clefReturns(() => {
      throw new Error(
        "4006: you have used up your daily free allocation of 10,000 neurons",
      );
    });
    await turnOn();
    const refused = await score({ posting: POSTING });
    expect(refused.status).toBe(503);
    expect(await refused.text()).toMatch(
      /shared allowance.*Don't call score_job again today/,
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
      name: "score_job",
      arguments: { posting: POSTING },
    })) as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Don't call score_job again/);
    expect(result.content[0].text).toMatch(/Don't estimate a match yourself/);
    expect(clef).not.toHaveBeenCalled();
  });

  it("scores through the MCP tool", async () => {
    await answers();
    await turnOn();
    const result = (await rpc("tools/call", {
      name: "score_job",
      arguments: { posting: POSTING },
    })) as { content: Array<{ text: string }> };
    expect(JSON.parse(result.content[0].text)).toMatchObject({ usedToday: 1 });
  });
});
