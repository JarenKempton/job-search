import { describe, expect, it } from "vitest";
import type { Application } from "../src/web/api";
import { toForm, toPatch } from "../src/web/components/form-state";
import { call, data, rpc } from "./helpers";

async function create(benefits: unknown = null) {
  const response = await call("/api/v1/applications", {
    method: "POST",
    json: {
      company: "Patch Co",
      role: "Engineer",
      requirements: ["resume"],
      notes: "Original note",
      benefits,
    },
  });
  expect(response.status).toBe(201);
  return data<Application>(response);
}

async function agentUpdate(id: string, benefits: unknown) {
  const result = await rpc("tools/call", {
    name: "update_application",
    arguments: { id, benefits },
  });
  expect(result.isError).not.toBe(true);
}

async function save(baseline: Application, form: ReturnType<typeof toForm>) {
  const response = await call(`/api/v1/applications/${baseline.id}`, {
    method: "PATCH",
    json: toPatch(form, baseline),
  });
  expect(response.status).toBe(200);
  return data<Application>(response);
}

describe("application form patches", () => {
  it("preserves MCP-added benefits on an unrelated stale form save", async () => {
    const baseline = await create();
    const form = toForm(baseline);
    form.company = "Renamed Co";
    await agentUpdate(baseline.id, {
      pto: { availability: "offered", policy: "fixed", daysPerYear: 20 },
    });
    const result = await save(baseline, form);
    expect(result.company).toBe("Renamed Co");
    expect(result.benefits?.pto?.daysPerYear).toBe(20);
    expect(toPatch(form, baseline)).toEqual({ company: "Renamed Co" });
  }, 15_000);

  it("preserves concurrent sibling and money updates while saving only changed nested facts", async () => {
    const baseline = await create({
      pto: { availability: "offered", daysPerYear: 20, rolloverDays: 0 },
      medical: {
        availability: "offered",
        employeeMonthlyPremium: { amountCents: 5000, currency: "USD" },
      },
    });
    const form = structuredClone(toForm(baseline));
    form.benefits!.pto!.daysPerYear = 25;
    form.benefits!.medical!.employeeMonthlyPremium!.amountCents = 7000;
    await agentUpdate(baseline.id, {
      pto: { rolloverDays: 7 },
      medical: {
        employeeMonthlyPremium: { currency: "CAD" },
        familyMonthlyPremium: { amountCents: 12000, currency: "CAD" },
      },
      vision: { availability: "offered" },
    });
    expect(toPatch(form, baseline)).toEqual({
      benefits: {
        pto: { daysPerYear: 25 },
        medical: { employeeMonthlyPremium: { amountCents: 7000 } },
      },
    });
    const result = await save(baseline, form);
    expect(result.benefits).toMatchObject({
      pto: { daysPerYear: 25, rolloverDays: 7 },
      medical: {
        employeeMonthlyPremium: { amountCents: 7000, currency: "CAD" },
        familyMonthlyPremium: { amountCents: 12000, currency: "CAD" },
      },
      vision: { availability: "offered" },
    });
  });

  it("sends nothing when the normalized form is unchanged", async () => {
    const baseline = await create({
      pto: { availability: "offered", daysPerYear: 20 },
    });
    const form = toForm(baseline);
    form.salaryMin = "";
    expect(toPatch(form, baseline)).toEqual({});
  });

  it("preserves explicit null clears and replaces changed arrays", async () => {
    const baseline = await create({
      pto: { availability: "offered", daysPerYear: 20 },
      dental: { availability: "offered" },
      retirement: {
        availability: "offered",
        matchTiers: [
          { employeeFromPercent: 0, employeeToPercent: 4, matchPercent: 100 },
        ],
      },
    });
    const form = structuredClone(toForm(baseline));
    form.notes = null;
    form.requirements = [];
    form.benefits!.pto!.daysPerYear = null;
    form.benefits!.dental = null;
    form.benefits!.retirement!.matchTiers = [];
    expect(toPatch(form, baseline)).toEqual({
      notes: null,
      requirements: [],
      benefits: {
        pto: { daysPerYear: null },
        dental: null,
        retirement: { matchTiers: [] },
      },
    });
    const result = await save(baseline, form);
    expect(result.notes).toBeNull();
    expect(result.requirements).toEqual([]);
    expect(result.benefits).toMatchObject({
      pto: { daysPerYear: null },
      dental: null,
      retirement: { matchTiers: [] },
    });
  });

  it("allows deliberately clearing all structured benefits", async () => {
    const baseline = await create({
      pto: { availability: "offered", daysPerYear: 20 },
    });
    const form = toForm(baseline);
    form.benefits = null;
    expect(toPatch(form, baseline)).toEqual({ benefits: null });
    expect((await save(baseline, form)).benefits).toBeNull();
  });

  it("includes new categories and zero-valued facts without unchanged top-level fields", async () => {
    const baseline = await create();
    const form = toForm(baseline);
    form.benefits = {
      medical: {
        availability: "offered",
        employeeMonthlyPremium: { amountCents: 0, currency: "USD" },
      },
    };
    expect(toPatch(form, baseline)).toEqual({ benefits: form.benefits });
    expect(
      (await save(baseline, form)).benefits?.medical?.employeeMonthlyPremium
        ?.amountCents,
    ).toBe(0);
  });
});
