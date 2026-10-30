import { DurableObject } from "cloudflare:workers";
import { asc, count, desc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import { mergeBenefits } from "./applications/benefits";
import type { Status } from "./applications/fields";
import { datesForStatus, statusNote } from "./applications/status";
import type {
  CreateApplicationInput,
  CreateEventInput,
  ResumeInput,
  UpdateApplicationInput,
} from "./applications/validation";
import { database, type Database } from "./db/client";
import { applicationEvents, applications, resumes } from "./db/schema";
import type { Env } from "./env";

const CHANGED = JSON.stringify({ type: "changed" });
const MOVED_FROM_D1 = "movedFromD1";
const RESUME = "current";

type NewApplication = Omit<CreateApplicationInput, "today">;
type ApplicationChanges = Omit<UpdateApplicationInput, "today">;

function statusEvent(
  applicationId: string,
  from: Status | null,
  to: Status,
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

function copyRows(
  sql: SqlStorage,
  table: string,
  rows: Record<string, SqlStorageValue>[],
) {
  for (const row of rows) {
    const columns = Object.keys(row);
    sql.exec(
      `INSERT INTO "${table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      ...Object.values(row),
    );
  }
}

export class Tracker extends DurableObject<Env> {
  private readonly db: Database;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.db = database(ctx.storage);
    ctx.setWebSocketAutoResponse(
      new WebSocketRequestResponsePair("ping", "pong"),
    );
    void ctx.blockConcurrencyWhile(async () => {
      await migrate(this.db, migrations);
      await this.moveFromD1();
    });
  }

  list(order: "updated" | "created") {
    return this.db
      .select()
      .from(applications)
      .orderBy(
        order === "created"
          ? asc(applications.createdAt)
          : desc(applications.updatedAt),
      )
      .all();
  }

  find(id: string) {
    const application = this.application(id);
    if (!application) return null;
    const events = this.db
      .select()
      .from(applicationEvents)
      .where(eq(applicationEvents.applicationId, id))
      .orderBy(
        desc(applicationEvents.occurredOn),
        desc(applicationEvents.createdAt),
      )
      .all();
    return { ...application, events };
  }

  create(input: NewApplication, today: string) {
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
    const created = this.db.transaction((tx) => {
      const row = tx.insert(applications).values(application).returning().get();
      tx.insert(applicationEvents)
        .values(statusEvent(application.id, null, input.status, today))
        .run();
      return row;
    });
    this.changed();
    return created;
  }

  update(id: string, input: ApplicationChanges, today: string) {
    const existing = this.application(id);
    if (!existing) return null;
    const { benefits, ...changes } = input;
    const merged =
      benefits === undefined
        ? { success: true as const, data: existing.benefits }
        : mergeBenefits(existing.benefits, benefits);
    if (!merged.success) {
      const issue = merged.error.issues[0];
      return {
        benefitsError: `benefits.${issue.path.join(".")}: ${issue.message}`,
      };
    }
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
    const updated = this.db.transaction((tx) => {
      if (changedStatus)
        tx.insert(applicationEvents)
          .values(statusEvent(id, existing.status, changedStatus, today))
          .run();
      return tx
        .update(applications)
        .set({
          ...changes,
          benefits: merged.data,
          ...dates,
          updatedAt: new Date(),
        })
        .where(eq(applications.id, id))
        .returning()
        .get();
    });
    this.changed();
    return updated;
  }

  remove(id: string) {
    if (!this.application(id)) return false;
    this.db.transaction((tx) => {
      tx.delete(applicationEvents)
        .where(eq(applicationEvents.applicationId, id))
        .run();
      tx.delete(applications).where(eq(applications.id, id)).run();
    });
    this.changed();
    return true;
  }

  addEvent(applicationId: string, input: CreateEventInput) {
    if (!this.application(applicationId)) return null;
    const event = {
      ...input,
      note: input.note ?? null,
      id: crypto.randomUUID(),
      applicationId,
      createdAt: new Date(),
    };
    this.db.transaction((tx) => {
      tx.insert(applicationEvents).values(event).run();
      tx.update(applications)
        .set({ updatedAt: new Date() })
        .where(eq(applications.id, applicationId))
        .run();
    });
    this.changed();
    return event;
  }

  removeEvent(id: string) {
    const deleted = this.db
      .delete(applicationEvents)
      .where(eq(applicationEvents.id, id))
      .returning({ id: applicationEvents.id })
      .get();
    if (deleted) this.changed();
    return deleted ?? null;
  }

  resume() {
    return (
      this.db.select().from(resumes).where(eq(resumes.id, RESUME)).get() ?? null
    );
  }

  saveResume(input: ResumeInput) {
    const resume = {
      id: RESUME,
      text: input.text,
      fileName: input.fileName ?? null,
      updatedAt: new Date(),
    };
    const saved = this.db
      .insert(resumes)
      .values(resume)
      .onConflictDoUpdate({ target: resumes.id, set: resume })
      .returning()
      .get();
    this.changed();
    return saved;
  }

  removeResume() {
    const removed = this.db
      .delete(resumes)
      .where(eq(resumes.id, RESUME))
      .returning({ id: resumes.id })
      .get();
    if (removed) this.changed();
    return Boolean(removed);
  }

  fetch() {
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  webSocketMessage() {}

  private application(id: string) {
    return this.db
      .select()
      .from(applications)
      .where(eq(applications.id, id))
      .get();
  }

  private changed() {
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(CHANGED);
      } catch {}
    }
  }

  private counts() {
    return {
      applications: this.db.select({ total: count() }).from(applications).get()!
        .total,
      events: this.db.select({ total: count() }).from(applicationEvents).get()!
        .total,
    };
  }

  private legacyDatabase() {
    const owners = JSON.parse(this.env.LEGACY_OWNERS ?? "{}") as Record<
      string,
      string
    >;
    const binding = Object.entries(owners).find(
      ([email]) => email.toLowerCase() === this.ctx.id.name,
    )?.[1];
    return binding === "JAREN_D1" || binding === "MAKAYLA_D1"
      ? this.env[binding]
      : undefined;
  }

  private async moveFromD1() {
    const source = this.legacyDatabase();
    if (!source || this.ctx.storage.kv.get(MOVED_FROM_D1)) return;
    const [legacyApplications, legacyEvents] = await source.batch<
      Record<string, SqlStorageValue>
    >([
      source.prepare("SELECT * FROM applications"),
      source.prepare("SELECT * FROM application_events"),
    ]);
    const moved = {
      applications: legacyApplications.results.length,
      events: legacyEvents.results.length,
    };
    this.ctx.storage.transactionSync(() => {
      const before = this.counts();
      copyRows(
        this.ctx.storage.sql,
        "applications",
        legacyApplications.results,
      );
      copyRows(
        this.ctx.storage.sql,
        "application_events",
        legacyEvents.results,
      );
      const after = this.counts();
      if (
        after.applications !== before.applications + moved.applications ||
        after.events !== before.events + moved.events
      )
        throw new Error("Row counts after the D1 move do not match.");
      this.ctx.storage.kv.put(MOVED_FROM_D1, { ...moved, at: Date.now() });
    });
    console.log(JSON.stringify({ movedFromD1: moved }));
  }
}
