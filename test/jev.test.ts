import { env, runInDurableObject } from "cloudflare:test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { combine, JEV_MODEL, redact } from "../src/jev";
import { call, data, rpc } from "./helpers";

const RESUME = `Alex Rivera
alex.rivera@example.com · (512) 555-0142 · linkedin.com/in/alexrivera · https://alex.dev
Product Engineer, 2019 - 2023 and 2023-2026
Skills: TypeScript, React, Node.js, PostgreSQL`;

const POSTING =
  "Senior TypeScript engineer. Requires 5+ years with React and Node.js, PostgreSQL experience, remote in the US.";

const ANSWERS = {
  model: "jev-1.14.0",
  answers: {
    skills: { type: "score", score: 3, confidence: 0.9 },
    experience: { type: "score", score: 2, confidence: 0.6 },
    domain: { type: "score", score: 1.5, confidence: 0.8 },
    hard_requirements: { type: "noul", noul: 1 },
  },
  usage: { input_tokens: 420, output_tokens: 0 },
};

function jevReturns(status: number, body: unknown = ANSWERS) {
  return vi
    .spyOn(globalThis, "fetch")
    .mockImplementation(
      async () => new Response(JSON.stringify(body), { status }),
    );
}

async function turnOn(ctx?: ExecutionContext) {
  await call("/api/v1/resume", { method: "PUT", json: { text: RESUME } }, ctx);
  return call("/api/v1/jev", { method: "PUT", json: { enabled: true } }, ctx);
}

const score = (json: Record<string, unknown>, ctx?: ExecutionContext) =>
  call("/api/v1/jev/score", { method: "POST", json }, ctx);

afterEach(() => {
  vi.restoreAllMocks();
});

describe("Jev match scores", () => {
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
    const jev = jevReturns(200);
    expect(await data(await call("/api/v1/jev"))).toEqual({
      enabled: true,
      usedToday: 0,
      dailyLimit: 50,
    });
    expect((await score({ posting: POSTING })).status).toBe(409);
    await call("/api/v1/jev", { method: "PUT", json: { enabled: false } });
    expect((await score({ posting: POSTING })).status).toBe(403);
    expect(jev).not.toHaveBeenCalled();
  });

  it("sends the redacted resume to the pinned model and saves the match on the application", async () => {
    const jev = jevReturns(200);
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
    const result = await data(
      await score({ posting: POSTING, applicationId: id }),
    );
    expect(result).toMatchObject({
      usedToday: 1,
      dailyLimit: 50,
      model: "jev-1.14.0",
    });
    const [url, init] = jev.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect(new Headers(init.headers).get("authorization")).toBe(
      "Bearer test-key",
    );
    const sent = JSON.parse(init.body as string);
    expect(sent.model).toBe(JEV_MODEL);
    expect(sent.state.job_posting).toBe(POSTING);
    expect(sent.state.resume).not.toMatch(/example\.com|555/);
    expect(
      (await data<{ fit: number }>(await call(`/api/v1/applications/${id}`)))
        .fit,
    ).toBe(result.match);
  });

  it("stops at the daily limit without calling TypeSafe", async () => {
    const jev = jevReturns(200);
    await turnOn();
    const stub = env.TRACKER.get(env.TRACKER.idFromName("jaren@example.test"));
    await runInDurableObject(stub, (_, state) => {
      const saved = state.storage.kv.get<{ day: string }>("jev")!;
      state.storage.kv.put("jev", { ...saved, used: 50 });
    });
    const limited = await score({ posting: POSTING, today: "2001-01-01" });
    expect(limited.status).toBe(429);
    expect(jev).not.toHaveBeenCalled();
  });

  it("doesn't count a score when TypeSafe is busy", async () => {
    jevReturns(429, { detail: "rate limited" });
    await turnOn();
    expect((await score({ posting: POSTING })).status).toBe(503);
    expect(await data(await call("/api/v1/jev"))).toMatchObject({
      usedToday: 0,
    });
  });

  it("tells the AI what to do when scores are off, instead of a bare failure", async () => {
    const jev = jevReturns(200);
    await turnOn();
    await call("/api/v1/jev", { method: "PUT", json: { enabled: false } });
    const result = (await rpc("tools/call", {
      name: "score_job",
      arguments: { posting: POSTING },
    })) as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Don't call score_job again/);
    expect(result.content[0].text).toMatch(/Don't estimate a match yourself/);
    expect(jev).not.toHaveBeenCalled();
  });

  it("scores through the MCP tool", async () => {
    jevReturns(200);
    await turnOn();
    const result = (await rpc("tools/call", {
      name: "score_job",
      arguments: { posting: POSTING },
    })) as { content: Array<{ text: string }> };
    expect(JSON.parse(result.content[0].text)).toMatchObject({ usedToday: 1 });
  });
});
