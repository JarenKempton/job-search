import { describe, expect, it } from "vitest";
import { call, data } from "./helpers";

type Row = Record<string, unknown> & { id: string };

async function create(json: Record<string, unknown>) {
  const response = await call("/api/v1/applications", { method: "POST", json });
  expect(response.status).toBe(201);
  return data<Row>(response);
}

describe("access", () => {
  it("rejects requests without a Cloudflare Access identity", async () => {
    const response = await call(
      "/api/v1/applications",
      {},
      {} as ExecutionContext,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "access_required" },
    });
  });
});

describe("applications", () => {
  it("stamps the applied date and logs the status when created as applied", async () => {
    const created = await create({
      company: "Acme",
      role: "Staff Engineer",
      status: "applied",
      source: "referral",
      applyMethod: "email",
      requirements: ["resume", "cover_letter"],
      salaryMin: 180000,
      salaryMax: 220000,
      fit: 80,
      today: "2026-10-01",
    });
    expect(created).toMatchObject({
      appliedOn: "2026-10-01",
      heardBackOn: null,
      requirements: ["resume", "cover_letter"],
    });

    const detail = await data<Row & { events: Row[] }>(
      await call(`/api/v1/applications/${created.id}`),
    );
    expect(detail.events).toMatchObject([{ kind: "status", note: "Applied" }]);
  });

  it("records when you heard back and logs the transition on a status change", async () => {
    const created = await create({
      company: "Globex",
      role: "Backend Engineer",
      status: "applied",
      today: "2026-10-01",
    });
    const response = await call(`/api/v1/applications/${created.id}`, {
      method: "PATCH",
      json: { status: "interviewing", today: "2026-10-09" },
    });
    expect(await data(response)).toMatchObject({
      status: "interviewing",
      appliedOn: "2026-10-01",
      heardBackOn: "2026-10-09",
    });

    const detail = await data<{ events: Row[] }>(
      await call(`/api/v1/applications/${created.id}`),
    );
    expect(detail.events.map((event) => event.note)).toEqual([
      "Applied → Interviewing",
      "Applied",
    ]);
  });

  it("keeps a timeline and deletes it with the application", async () => {
    const created = await create({ company: "Initech", role: "SRE" });
    const event = await data<Row>(
      await call(`/api/v1/applications/${created.id}/events`, {
        method: "POST",
        json: { kind: "interview", occurredOn: "2026-10-12", note: "Panel" },
      }),
    );
    expect(event).toMatchObject({ kind: "interview", note: "Panel" });

    expect(
      (await call(`/api/v1/applications/${created.id}`, { method: "DELETE" }))
        .status,
    ).toBe(200);
    expect(
      (await call(`/api/v1/events/${event.id}`, { method: "DELETE" })).status,
    ).toBe(404);
  });

  it("preserves, updates, clears, and exports benefits without assuming unknown benefits", async () => {
    const created = await create({
      company: "Benefits Co",
      role: "Analyst",
      pto: "20 vacation days; 5 roll over",
      healthcare: "Medical, dental, vision; $120/month; starts day one",
      retirement: "4% match, vested immediately",
      benefitsSource: "Recruiter email, 2026-10-28",
    });
    expect(created).toMatchObject({
      pto: "20 vacation days; 5 roll over",
      sickLeave: null,
    });
    const updated = await call(`/api/v1/applications/${created.id}`, {
      method: "PATCH",
      json: {
        pto: "Unlimited",
        retirement: null,
        otherBenefits: "=unconfirmed",
      },
    });
    expect(updated.status).toBe(200);
    const detail = await data(await call(`/api/v1/applications/${created.id}`));
    expect(detail).toMatchObject({
      pto: "Unlimited",
      retirement: null,
      healthcare: created.healthcare,
      benefitsSource: created.benefitsSource,
    });
    const csv = await (await call("/api/v1/applications.csv")).text();
    expect(csv.split("\r\n")[0]).toContain(
      "pto,sickLeave,holidays,healthcare,retirement,parentalLeave,otherBenefits,benefitsNotes,benefitsSource",
    );
    expect(csv).toContain("Unlimited");
    expect(csv).toContain("'\u003dunconfirmed");
    expect(csv).toContain(
      '"Medical, dental, vision; $120/month; starts day one"',
    );

    const invalid = await call(`/api/v1/applications/${created.id}`, {
      method: "PATCH",
      json: { pto: "x".repeat(5001) },
    });
    expect(invalid.status).toBe(422);
  });

  it("rejects an inverted salary range with a readable message", async () => {
    const response = await call("/api/v1/applications", {
      method: "POST",
      json: { company: "A", role: "B", salaryMin: 200000, salaryMax: 100000 },
    });
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: { message: "Salary minimum must not exceed the maximum." },
    });
  });

  it("exports CSV that neutralizes spreadsheet formulas", async () => {
    await create({ company: "=HYPERLINK(1)", role: "Dev, Senior" });
    const response = await call("/api/v1/applications.csv");
    const [, row] = (await response.text()).split("\r\n");
    expect(row.startsWith(`'=HYPERLINK(1),"Dev, Senior",saved`)).toBe(true);
  });
});
