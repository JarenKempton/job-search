import { applyD1Migrations, env, evictDurableObject } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { call, data, signedInAs } from "./helpers";

const mover = signedInAs("mover@example.test");
const applicationId = "6f1c2c8e-8a4b-4f7e-9d1a-2b3c4d5e6f70";

type Row = Record<string, unknown> & { id: string };

beforeEach(async () => {
  await applyD1Migrations(env.JAREN_D1!, env.TEST_MIGRATIONS);
  await env.JAREN_D1!.batch([
    env
      .JAREN_D1!.prepare(
        `INSERT INTO applications (id, company, role, requirements, status, applied_on, pto, created_at, updated_at)
       VALUES (?, 'Legacy Co', 'Engineer', '["resume"]', 'applied', '2026-09-01', '15 days', 1790000000000, 1790000500000)`,
      )
      .bind(applicationId),
    env
      .JAREN_D1!.prepare(
        `INSERT INTO application_events (id, application_id, kind, occurred_on, note, created_at)
       VALUES ('7a1c2c8e-8a4b-4f7e-9d1a-2b3c4d5e6f71', ?, 'status', '2026-09-01', 'Applied', 1790000000000)`,
      )
      .bind(applicationId),
  ]);
});

describe("moving legacy D1 data", () => {
  it("copies the mapped person's D1 rows into their object on first sign-in", async () => {
    const detail = await data<Row & { events: Row[] }>(
      await call(`/api/v1/applications/${applicationId}`, {}, mover),
    );
    expect(detail).toMatchObject({
      company: "Legacy Co",
      requirements: ["resume"],
      status: "applied",
      appliedOn: "2026-09-01",
      pto: "15 days",
      createdAt: new Date(1790000000000).toISOString(),
      updatedAt: new Date(1790000500000).toISOString(),
    });
    expect(detail.events).toMatchObject([{ kind: "status", note: "Applied" }]);
    expect(
      await data(
        await call(
          "/api/v1/applications",
          {},
          signedInAs("other@example.test"),
        ),
      ),
    ).toEqual([]);
  });

  it("never copies again, even after the person deletes everything", async () => {
    await call(
      `/api/v1/applications/${applicationId}`,
      { method: "DELETE" },
      mover,
    );
    await evictDurableObject(
      env.TRACKER.get(env.TRACKER.idFromName("mover@example.test")),
    );
    expect(await data(await call("/api/v1/applications", {}, mover))).toEqual(
      [],
    );
  });
});
