import { env, runInDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { call, signedInAs } from "./helpers";

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

  it("resets each minute and caps a day at 2,000", async () => {
    const stub = env.TRACKER.get(env.TRACKER.idFromName("daily@example.test"));
    await runInDurableObject(stub, (tracker) => {
      const minute = 60_000;
      let now = 1_800_000_000_000;
      for (let request = 0; request < 2_000; request++) {
        if (request % 120 === 0) now += minute;
        expect(tracker.retryAfter(now)).toBe(0);
      }
      expect(tracker.retryAfter(now)).toBeGreaterThan(3_600);
      expect(tracker.retryAfter(now + 86_400_000)).toBe(0);
    });
  });
});
