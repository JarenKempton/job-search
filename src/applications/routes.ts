import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { database, type Database } from "../db/client";
import {
  applicationEvents,
  applications,
  type Application,
} from "../db/schema";
import type { AppEnv } from "../env";
import { ApiError, ok, readJson } from "../lib/http";
import { requireUuid } from "../lib/query";
import { toCsv } from "./csv";
import { datesForStatus, statusNote, utcToday } from "./status";
import {
  createApplicationSchema,
  createEventSchema,
  updateApplicationSchema,
} from "./validation";

async function findApplication(db: Database, id: string) {
  const row = await db
    .select()
    .from(applications)
    .where(eq(applications.id, id))
    .get();
  if (!row)
    throw new ApiError(404, "application_not_found", "Application not found.");
  return row;
}

function statusEvent(
  applicationId: string,
  from: Application["status"] | null,
  to: Application["status"],
  today: string,
) {
  return {
    id: crypto.randomUUID(),
    applicationId,
    kind: "status" as const,
    occurredOn: today,
    note: statusNote(from, to),
    createdAt: new Date(),
  };
}

export const applicationRoutes = new Hono<AppEnv>()
  .get("/api/v1/applications", async (context) => {
    const rows = await database(context.env.DB)
      .select()
      .from(applications)
      .orderBy(desc(applications.updatedAt))
      .all();
    return ok(rows);
  })
  .get("/api/v1/applications.csv", async (context) => {
    const rows = await database(context.env.DB)
      .select()
      .from(applications)
      .orderBy(asc(applications.createdAt))
      .all();
    return new Response(toCsv(rows), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="applications-${utcToday()}.csv"`,
      },
    });
  })
  .post("/api/v1/applications", async (context) => {
    const { today = utcToday(), ...input } = createApplicationSchema.parse(
      await readJson(context.req.raw),
    );
    const db = database(context.env.DB);
    const now = new Date();
    const application = {
      ...input,
      ...datesForStatus(
        input.status,
        {
          appliedOn: input.appliedOn ?? null,
          heardBackOn: input.heardBackOn ?? null,
        },
        today,
      ),
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
    };
    const [created] = await db.batch([
      db.insert(applications).values(application).returning(),
      db
        .insert(applicationEvents)
        .values(statusEvent(application.id, null, input.status, today)),
    ]);
    return ok(created[0], { status: 201 });
  })
  .get("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const db = database(context.env.DB);
    const application = await findApplication(db, id);
    const events = await db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, id))
      .orderBy(
        desc(applicationEvents.occurredOn),
        desc(applicationEvents.createdAt),
      )
      .all();
    return ok({ ...application, events });
  })
  .patch("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const { today = utcToday(), ...input } = updateApplicationSchema.parse(
      await readJson(context.req.raw),
    );
    const db = database(context.env.DB);
    const existing = await findApplication(db, id);
    const changedStatus =
      input.status && input.status !== existing.status ? input.status : null;
    const dates = changedStatus
      ? datesForStatus(
          changedStatus,
          {
            appliedOn:
              input.appliedOn !== undefined
                ? input.appliedOn
                : existing.appliedOn,
            heardBackOn:
              input.heardBackOn !== undefined
                ? input.heardBackOn
                : existing.heardBackOn,
          },
          today,
        )
      : {};
    const update = db
      .update(applications)
      .set({ ...input, ...dates, updatedAt: new Date() })
      .where(eq(applications.id, id))
      .returning();
    const [updated] = changedStatus
      ? await db.batch([
          update,
          db
            .insert(applicationEvents)
            .values(statusEvent(id, existing.status, changedStatus, today)),
        ])
      : [await update];
    return ok(updated[0]);
  })
  .delete("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const db = database(context.env.DB);
    await findApplication(db, id);
    await db.batch([
      db
        .delete(applicationEvents)
        .where(eq(applicationEvents.applicationId, id)),
      db.delete(applications).where(eq(applications.id, id)),
    ]);
    return ok({ id });
  })
  .post("/api/v1/applications/:id/events", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const input = createEventSchema.parse(await readJson(context.req.raw));
    const db = database(context.env.DB);
    await findApplication(db, id);
    const event = {
      ...input,
      note: input.note ?? null,
      id: crypto.randomUUID(),
      applicationId: id,
      createdAt: new Date(),
    };
    await db.batch([
      db.insert(applicationEvents).values(event),
      db
        .update(applications)
        .set({ updatedAt: new Date() })
        .where(eq(applications.id, id)),
    ]);
    return ok(event, { status: 201 });
  })
  .delete("/api/v1/events/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Event");
    const deleted = await database(context.env.DB)
      .delete(applicationEvents)
      .where(eq(applicationEvents.id, id))
      .returning({ id: applicationEvents.id })
      .get();
    if (!deleted)
      throw new ApiError(404, "event_not_found", "Event not found.");
    return ok(deleted);
  });
