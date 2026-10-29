import { describe, expect, it } from "vitest";
import type { Application } from "../src/web/api";
import { needsFollowUp, summarize } from "../src/web/stats";

const base = {
  status: "applied",
  appliedOn: "2026-10-01",
  heardBackOn: null,
  followUpOn: null,
  source: "linkedin",
  fit: null,
} as unknown as Application;

const row = (patch: Partial<Application>) =>
  ({ ...base, ...patch }) as Application;

describe("stats", () => {
  it("flags applications with no reply after two weeks", () => {
    expect(needsFollowUp(row({}), "2026-10-14")).toBe(false);
    expect(needsFollowUp(row({}), "2026-10-15")).toBe(true);
    expect(needsFollowUp(row({ status: "rejected" }), "2026-12-01")).toBe(
      false,
    );
    expect(needsFollowUp(row({ followUpOn: "2026-10-03" }), "2026-10-03")).toBe(
      true,
    );
  });

  it("computes response rate per source", () => {
    const stats = summarize(
      [
        row({ heardBackOn: "2026-10-05", status: "rejected" }),
        row({}),
        row({
          source: "referral",
          status: "interviewing",
          heardBackOn: "2026-10-03",
        }),
        row({ status: "saved", appliedOn: null }),
      ],
      "2026-10-10",
    );
    expect(stats.applied).toBe(3);
    expect(stats.responseRate).toBeCloseTo(2 / 3);
    expect(stats.medianDaysToResponse).toBe(3);
    expect(stats.sources).toMatchObject([
      { source: "linkedin", applied: 2, responses: 1, rate: 0.5 },
      { source: "referral", applied: 1, responses: 1, interviews: 1 },
    ]);
  });
});
