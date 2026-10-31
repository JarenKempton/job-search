import { describe, expect, it } from "vite-plus/test";
import type { Application } from "../src/web/api";
import {
  daysWaiting,
  hasBenefits,
  nextAction,
  stageOf,
} from "../src/web/board";
import { needsFollowUp, summarize } from "../src/web/stats";

const base = {
  company: "Acme",
  status: "applied",
  appliedOn: "2026-10-01",
  heardBackOn: null,
  followUpOn: null,
  salaryMin: null,
  salaryMax: null,
  source: "linkedin",
  fit: null,
  createdAt: "2026-09-28T15:00:00.000Z",
  pto: null,
  healthcare: null,
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

  it("stops suggesting a follow-up once skipped", () => {
    const skipped = row({ skipFollowUp: true });
    expect(needsFollowUp(skipped, "2026-11-01")).toBe(false);
    expect(nextAction(skipped, "2026-11-01")).toEqual({
      text: "Wait for a reply",
      on: null,
      due: false,
    });
  });

  it("computes response and rejection rates over applied jobs", () => {
    const stats = summarize(
      [
        row({ heardBackOn: "2026-10-05", status: "rejected" }),
        row({}),
        row({ status: "interviewing", heardBackOn: "2026-10-03" }),
        row({ status: "ghosted" }),
        row({ status: "saved", appliedOn: null }),
      ],
      "2026-10-10",
    );
    expect(stats.total).toBe(5);
    expect(stats.responseRate).toBe(0.5);
    expect(stats.rejectionRate).toBe(0.25);
    expect(stats.followUpsDue).toBe(0);
  });

  it("summarizes salaries of open jobs, using whichever bound is known", () => {
    const stats = summarize(
      [
        row({ company: "Low", salaryMin: 90_000, salaryMax: 110_000 }),
        row({ company: "High", salaryMax: 200_000 }),
        row({ company: "Mid", salaryMin: 150_000 }),
        row({ company: "Gone", status: "rejected", salaryMin: 500_000 }),
        row({ company: "Unknown" }),
      ],
      "2026-10-10",
    );
    expect(stats.salaryCount).toBe(3);
    expect(stats.averageSalary).toBe(150_000);
    expect(stats.highestSalary).toMatchObject({
      value: 200_000,
      row: { company: "High" },
    });
    expect(stats.lowestSalary).toMatchObject({
      value: 90_000,
      row: { company: "Low" },
    });
  });

  it("has no salary figures when no open job lists pay", () => {
    const stats = summarize([row({})], "2026-10-10");
    expect(stats.averageSalary).toBeNull();
    expect(stats.highestSalary).toBeNull();
    expect(stats.lowestSalary).toBeNull();
  });
});

describe("board", () => {
  it("groups statuses into board columns", () => {
    expect(stageOf("screening").title).toBe("Heard back");
    expect(stageOf("accepted").key).toBe("offer");
    expect(stageOf("ghosted").key).toBe("closed");
  });

  it("counts days waiting since the last reply, application or save", () => {
    expect(daysWaiting(row({}), "2026-10-11")).toBe(10);
    expect(daysWaiting(row({ heardBackOn: "2026-10-08" }), "2026-10-11")).toBe(
      3,
    );
    expect(
      daysWaiting(row({ status: "saved", appliedOn: null }), "2026-10-01"),
    ).toBe(3);
    expect(daysWaiting(row({ status: "rejected" }), "2026-10-11")).toBeNull();
  });

  it("reports benefits as filled in only when some text is present", () => {
    expect(hasBenefits(row({}))).toBe(false);
    expect(hasBenefits(row({ pto: "  " }))).toBe(false);
    expect(hasBenefits(row({ healthcare: "Day one" }))).toBe(true);
  });

  it("suggests the next action", () => {
    expect(nextAction(row({}), "2026-10-05")).toEqual({
      text: "Follow up",
      on: "2026-10-15",
      due: false,
    });
    expect(nextAction(row({}), "2026-10-20")).toEqual({
      text: "Follow up",
      on: "2026-10-15",
      due: true,
    });
    expect(
      nextAction(row({ followUpOn: "2026-10-04" }), "2026-10-05"),
    ).toMatchObject({ on: "2026-10-04", due: true });
    expect(nextAction(row({ status: "saved" }), "2026-10-05")?.text).toBe(
      "Apply",
    );
    expect(nextAction(row({ status: "withdrawn" }), "2026-10-05")).toBeNull();
  });
});
