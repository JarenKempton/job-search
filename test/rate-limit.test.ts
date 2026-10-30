import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, rpc, signedInAs } from "./helpers";

const busy = signedInAs("busy@example.test");

describe("per-person rate limit", () => {
  it("answers 429 with Retry-After after 120 requests in a minute, only for that person", async () => {
    for (let index = 0; index < 120; index++)
      expect((await call("/api/v1/applications", {}, busy)).status).toBe(200);
    const limited = await call("/api/v1/applications", {}, busy);
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get("retry-after"))).toBeGreaterThan(0);
    expect((await call("/api/v1/applications")).status).toBe(200);
  });

  it("tells an AI tool to wait instead of failing the MCP connection", async () => {
    for (let index = 0; index < 120; index++)
      await call("/api/v1/applications");
    const result = (await rpc("tools/call", {
      name: "list_applications",
      arguments: {},
    })) as { isError: boolean; content: Array<{ text: string }> };
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Wait \d+ seconds/);
  });

  it("resets each minute and caps a day at 10,000", async () => {
    const stub = env.TRACKER.get(env.TRACKER.idFromName("daily@example.test"));
    await runInDurableObject(stub, (tracker) => {
      const minute = 60_000;
      let now = 1_800_000_000_000;
      for (let request = 0; request < 10_000; request++) {
        if (request % 120 === 0) now += minute;
        expect(tracker.retryAfter(now)).toBe(0);
      }
      expect(tracker.retryAfter(now)).toBeGreaterThan(3_600);
      expect(tracker.retryAfter(now + 86_400_000)).toBe(0);
    });
  });

  it("doesn't count refused requests toward the day", async () => {
    const stub = env.TRACKER.get(env.TRACKER.idFromName("loop@example.test"));
    await runInDurableObject(stub, (tracker) => {
      const start = 1_800_000_000_000;
      for (let request = 0; request < 120; request++) tracker.retryAfter(start);
      for (let request = 0; request < 20_000; request++)
        expect(tracker.retryAfter(start + 1_000)).toBeGreaterThan(0);
      let now = start + 60_000;
      for (let request = 0; request < 9_880; request++) {
        if (request % 120 === 0) now += 60_000;
        expect(tracker.retryAfter(now)).toBe(0);
      }
    });
  });
});
