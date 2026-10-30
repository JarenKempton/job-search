import { env, evictDurableObject } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import type { Application } from "../src/web/api";
import { toForm, toInput } from "../src/web/components/form-state";
import { call, data, rpc } from "./helpers";

const tiers = [
  { employeeFromPercent: 0, employeeToPercent: 4, matchPercent: 100 },
  { employeeFromPercent: 4, employeeToPercent: 6, matchPercent: 50 },
];

async function create(benefits?: unknown, legacy: Record<string, string> = {}) {
  const response = await call("/api/v1/applications", {
    method: "POST",
    json: { company: "Benefits Co", role: "Engineer", ...legacy, benefits },
  });
  expect(response.status).toBe(201);
  return data<Application>(response);
}

function patch(
  id: string,
  benefits: unknown,
  extra: Record<string, unknown> = {},
) {
  return call(`/api/v1/applications/${id}`, {
    method: "PATCH",
    json: { ...extra, benefits },
  });
}

async function tool(name: string, args: Record<string, unknown>) {
  const result = await rpc("tools/call", { name, arguments: args });
  expect(result.isError).not.toBe(true);
  return JSON.parse(
    (result.content as Array<{ text: string }>)[0].text,
  ) as Application;
}

describe("structured benefits", () => {
  it("persists typed facts without converting legacy text", async () => {
    const created = await create(
      {
        pto: { availability: "offered", policy: "unlimited" },
        medical: {
          availability: "offered",
          employeeMonthlyPremium: { amountCents: 0, currency: "USD" },
        },
        dental: { availability: "unknown" },
        vision: { availability: "not_offered" },
      },
      { pto: "Generous PTO" },
    );
    await evictDurableObject(
      env.TRACKER.get(env.TRACKER.idFromName("jaren@example.test")),
    );
    const detail = await data<Application>(
      await call(`/api/v1/applications/${created.id}`),
    );
    expect(detail).toMatchObject({
      pto: "Generous PTO",
      benefits: {
        pto: { availability: "offered", policy: "unlimited" },
        medical: {
          employeeMonthlyPremium: { amountCents: 0, currency: "USD" },
        },
        dental: { availability: "unknown" },
        vision: { availability: "not_offered" },
      },
    });
    expect(detail.benefits?.pto?.daysPerYear).toBeUndefined();
    expect(detail.benefits?.dental?.employeeMonthlyPremium).toBeUndefined();
    expect(await data(await call("/api/v1/applications"))).toEqual([created]);
  });

  it("keeps legacy clients working and distinguishes absent, unknown, not offered, and zero", async () => {
    const legacy = await create(undefined, {
      pto: "Generous PTO",
      healthcare: "Ask recruiter",
    });
    expect(legacy.benefits).toBeNull();
    const saved = await create({
      pto: {},
      sickLeave: { availability: "not_offered" },
      holidays: {
        availability: "offered",
        daysPerYear: 0,
        floatingDaysPerYear: null,
      },
    });
    expect(saved.benefits).toEqual({
      pto: { availability: "unknown" },
      sickLeave: { availability: "not_offered" },
      holidays: {
        availability: "offered",
        daysPerYear: 0,
        floatingDaysPerYear: null,
      },
    });
    const response = await call(`/api/v1/applications/${legacy.id}`, {
      method: "PATCH",
      json: { notes: "Interview" },
    });
    expect(await data(response)).toMatchObject({
      pto: "Generous PTO",
      healthcare: "Ask recruiter",
      benefits: null,
    });
  });

  it("merges nested objects, preserves sibling groups, replaces arrays, and explicitly clears facts", async () => {
    const created = await create({
      pto: {
        availability: "offered",
        policy: "accrued",
        daysPerYear: 18.5,
        rolloverDays: 5,
        source: "Handbook",
        checkedOn: "2026-10-29",
      },
      medical: {
        availability: "offered",
        employeeMonthlyPremium: { amountCents: 12550, currency: "USD" },
        familyMonthlyPremium: { amountCents: 80000, currency: "USD" },
      },
      retirement: {
        availability: "offered",
        planType: "401(k)",
        matchTiers: tiers,
        employerContributionPercent: 2,
        monthsUntilFullyVested: 36,
      },
      parentalLeave: {
        availability: "offered",
        policies: [
          { eligibleParents: "Birth parent", paidWeeks: 12.5, payPercent: 100 },
          { eligibleParents: "Other parent", paidWeeks: 6, payPercent: 100 },
        ],
      },
      stipends: {
        availability: "offered",
        items: [
          {
            category: "Wellness",
            amount: { amountCents: 5000, currency: "USD" },
            cadence: "monthly",
          },
          {
            category: "Equipment",
            amount: { amountCents: 150000, currency: "USD" },
            cadence: "one_time",
          },
        ],
      },
    });
    expect(created.benefits?.retirement?.matchTiers).toEqual(tiers);
    const response = await patch(created.id, {
      pto: { rolloverDays: null },
      medical: { employeeMonthlyPremium: { amountCents: 0 } },
      retirement: { matchTiers: [tiers[0]] },
      parentalLeave: {
        policies: [{ eligibleParents: "Any eligible parent", unpaidWeeks: 6 }],
      },
      stipends: {
        items: [
          {
            category: "Learning",
            amount: { amountCents: 100000, currency: "EUR" },
            cadence: "annual",
          },
        ],
      },
    });
    expect(response.status).toBe(200);
    const saved = await data<Application>(response);
    expect(saved.benefits).toMatchObject({
      pto: {
        availability: "offered",
        daysPerYear: 18.5,
        rolloverDays: null,
        source: "Handbook",
        checkedOn: "2026-10-29",
      },
      medical: {
        employeeMonthlyPremium: { amountCents: 0, currency: "USD" },
        familyMonthlyPremium: { amountCents: 80000, currency: "USD" },
      },
      retirement: {
        matchTiers: [tiers[0]],
        employerContributionPercent: 2,
        monthsUntilFullyVested: 36,
      },
      parentalLeave: {
        policies: [{ eligibleParents: "Any eligible parent", unpaidWeeks: 6 }],
      },
      stipends: {
        items: [
          {
            category: "Learning",
            amount: { amountCents: 100000, currency: "EUR" },
            cadence: "annual",
          },
        ],
      },
    });
    const cleared = await data<Application>(
      await patch(created.id, {
        medical: { employeeMonthlyPremium: null },
        retirement: { matchTiers: [] },
        pto: null,
      }),
    );
    expect(cleared.benefits?.medical?.employeeMonthlyPremium).toBeNull();
    expect(cleared.benefits?.medical?.familyMonthlyPremium).toEqual(
      created.benefits?.medical?.familyMonthlyPremium,
    );
    expect(cleared.benefits?.retirement?.matchTiers).toEqual([]);
    expect(cleared.benefits?.pto).toBeNull();
    const emptied = await data<Application>(await patch(created.id, null));
    expect(emptied.benefits).toBeNull();
  });

  it("preserves concurrent category updates inside the tenant object", async () => {
    const created = await create({
      medical: { availability: "offered", coverageWaitingDays: 30 },
    });
    const responses = await Promise.all([
      patch(created.id, { pto: { availability: "offered", daysPerYear: 20 } }),
      patch(created.id, {
        retirement: { availability: "offered", matchTiers: tiers },
      }),
    ]);
    expect(responses.map((response) => response.status)).toEqual([200, 200]);
    expect(
      await data(await call(`/api/v1/applications/${created.id}`)),
    ).toMatchObject({
      benefits: {
        pto: { daysPerYear: 20 },
        medical: { coverageWaitingDays: 30 },
        retirement: { matchTiers: tiers },
      },
    });
  });

  it("clears prior facts on not-offered, unlimited, and included-PTO transitions but keeps provenance", async () => {
    const created = await create({
      pto: {
        availability: "offered",
        policy: "fixed",
        daysPerYear: 20,
        source: "Handbook",
      },
      sickLeave: {
        availability: "offered",
        policy: "separate",
        daysPerYear: 5,
      },
      medical: {
        availability: "offered",
        employeeMonthlyPremium: { amountCents: 10000, currency: "USD" },
        coverageWaitingDays: 0,
        notes: "Confirmed by recruiter",
        checkedOn: "2026-10-29",
      },
    });
    const response = await patch(created.id, {
      pto: { policy: "unlimited" },
      sickLeave: { policy: "included_in_pto" },
      medical: { availability: "not_offered" },
    });
    expect(response.status).toBe(200);
    const saved = await data<Application>(response);
    expect(saved.benefits).toMatchObject({
      pto: { policy: "unlimited", daysPerYear: null, source: "Handbook" },
      sickLeave: { policy: "included_in_pto", daysPerYear: null },
      medical: {
        availability: "not_offered",
        employeeMonthlyPremium: null,
        coverageWaitingDays: null,
        notes: "Confirmed by recruiter",
        checkedOn: "2026-10-29",
      },
    });
    const invalid = await patch(
      created.id,
      { medical: { employerContributionPercent: 50 } },
      { status: "offer" },
    );
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({
      error: {
        code: "validation_error",
        message: expect.stringContaining("Not-offered"),
      },
    });
    const detail = await data<Application & { events: unknown[] }>(
      await call(`/api/v1/applications/${created.id}`),
    );
    expect(detail.status).toBe("saved");
    expect(detail.events).toHaveLength(1);
    expect(detail.benefits).toEqual(saved.benefits);
  });

  it("exports JSON facts safely in CSV and round-trips typed form state without object coercion", async () => {
    const created = await create(
      {
        pto: { availability: "offered", daysPerYear: 15.5 },
        medical: {
          availability: "offered",
          employeeMonthlyPremium: { amountCents: 0, currency: "USD" },
        },
      },
      { benefitsSource: "Recruiter email", pto: "Generous PTO" },
    );
    expect(toInput(toForm(created))).toMatchObject({
      benefits: created.benefits,
      pto: "Generous PTO",
      benefitsSource: "Recruiter email",
    });
    const csv = await (await call("/api/v1/applications.csv")).text();
    expect(csv.split("\r\n")[0]).toContain("benefitsSource,benefits");
    expect(csv).toContain('""amountCents"":0');
    expect(csv).toContain('""daysPerYear"":15.5');
    expect(csv).toContain("Generous PTO");
    expect(csv).not.toContain("[object Object]");
  });

  it("uses the same benefits schema and nested patch semantics over remote MCP", async () => {
    const added = await tool("add_application", {
      company: "MCP Benefits",
      role: "Engineer",
      retirement: "Verify vesting",
      benefits: {
        retirement: {
          availability: "offered",
          planType: "401(k)",
          matchTiers: tiers,
        },
        dental: { availability: "offered", coverageWaitingDays: 0 },
        medical: { availability: "unknown" },
      },
    });
    await tool("update_application", {
      id: added.id,
      benefits: {
        retirement: { monthsUntilFullyVested: 12 },
        dental: { availability: "not_offered" },
        medical: null,
      },
    });
    const detail = await tool("get_application", { id: added.id });
    expect(detail).toMatchObject({
      retirement: "Verify vesting",
      benefits: {
        retirement: {
          planType: "401(k)",
          matchTiers: tiers,
          monthsUntilFullyVested: 12,
        },
        dental: { availability: "not_offered", coverageWaitingDays: null },
        medical: null,
      },
    });
    await tool("update_application", {
      id: added.id,
      benefits: { retirement: { matchTiers: [tiers[1]] } },
    });
    expect(
      (await tool("get_application", { id: added.id })).benefits?.retirement
        ?.matchTiers,
    ).toEqual([tiers[1]]);
    const invalid = await rpc("tools/call", {
      name: "update_application",
      arguments: {
        id: added.id,
        benefits: { dental: { coverageWaitingDays: 0 } },
      },
    });
    expect(invalid.isError).toBe(true);
    await tool("update_application", { id: added.id, benefits: null });
    expect(
      (await tool("get_application", { id: added.id })).benefits,
    ).toBeNull();
  });

  it("allows real match rates above 100% without inflating the employee contribution range", async () => {
    const created = await create({
      retirement: {
        availability: "offered",
        matchTiers: [
          { employeeFromPercent: 0, employeeToPercent: 5, matchPercent: 200 },
        ],
      },
    });
    expect(created.benefits?.retirement?.matchTiers?.[0].matchPercent).toBe(
      200,
    );
    const unknown = await create({
      retirement: {
        availability: "offered",
        matchTiers: [
          {
            employeeFromPercent: null,
            employeeToPercent: null,
            matchPercent: null,
          },
        ],
      },
    });
    expect(
      unknown.benefits?.retirement?.matchTiers?.[0].matchPercent,
    ).toBeNull();
  });

  it.each([
    { pto: { availability: "not_offered", daysPerYear: 0 } },
    { pto: { policy: "unlimited", daysPerYear: 20 } },
    { sickLeave: { policy: "included_in_pto", daysPerYear: 5 } },
    { holidays: { daysPerYear: -1 } },
    {
      medical: {
        employeeMonthlyPremium: { amountCents: 12.5, currency: "USD" },
      },
    },
    { medical: { employeeMonthlyPremium: { amountCents: 1200 } } },
    { dental: { deductible: { amountCents: 0, currency: "usd" } } },
    { vision: { employerContributionPercent: 101 } },
    { medical: { coverageWaitingDays: 1.5 } },
    { pto: { checkedOn: "2026-02-30" } },
    {
      retirement: {
        matchTiers: [
          { employeeFromPercent: 4, employeeToPercent: 4, matchPercent: 100 },
        ],
      },
    },
    { retirement: { matchTiers: [tiers[1], tiers[0]] } },
    {
      retirement: {
        matchTiers: [
          tiers[0],
          { employeeFromPercent: 3, employeeToPercent: 6, matchPercent: 50 },
        ],
      },
    },
    {
      retirement: {
        matchTiers: [
          { employeeFromPercent: 0, employeeToPercent: 101, matchPercent: 200 },
        ],
      },
    },
    {
      retirement: {
        matchTiers: [
          { employeeFromPercent: 0, employeeToPercent: 5, matchPercent: -1 },
        ],
      },
    },
    { retirement: { monthsUntilFullyVested: 1.5 } },
    {
      parentalLeave: {
        policies: [{ eligibleParents: "Any parent", payPercent: 101 }],
      },
    },
    { parentalLeave: { policies: [{ eligibleParents: "", paidWeeks: 4 }] } },
    { stipends: { items: [{ category: "Learning", cadence: "weekly" }] } },
    { medical: { employeePremium: 100 } },
  ])("rejects invalid facts at create and patch: %j", async (benefits) => {
    const response = await call("/api/v1/applications", {
      method: "POST",
      json: { company: "Invalid", role: "Engineer", benefits },
    });
    expect(response.status).toBe(422);
    const created = await create();
    expect((await patch(created.id, benefits)).status).toBe(422);
    expect(
      (
        await data<Application>(
          await call(`/api/v1/applications/${created.id}`),
        )
      ).benefits,
    ).toBeNull();
  });
});
