import { DurableObject } from "cloudflare:workers";
import { asc, count, desc, eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "../drizzle/migrations.js";
import { mergeBenefits } from "./applications/benefits";
import { matchRating, type Status } from "./applications/fields";
import { datesForStatus, statusNote, utcToday } from "./applications/status";
import type {
  CreateApplicationInput,
  CreateEventInput,
  ResumeInput,
  UpdateApplicationInput,
} from "./applications/validation";
import { database, type Database } from "./db/client";
import { applicationEvents, applications, resumes } from "./db/schema";
import type { Env } from "./env";
import { askClef, DAILY_SCORES, type JobMatch } from "./match";

const CHANGED = JSON.stringify({ type: "changed" });
const MOVED_FROM_D1 = "movedFromD1";
const RESUME = "current";
const MATCH_SCORES = "matchScores";
const SCORE_CACHE = "scoreCache";

type MatchSettings = { enabled: boolean; day: string; used: number };
type JobToScore = {
  label: string;
  posting: string;
  applicationId?: string | null;
};

async function scoreKey(resume: string, posting: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${resume}\n\u0000\n${posting}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

const failure = (status: number, code: string, message: string) => ({
  failure: { status, code, message },
});
const LIMITS = [
  { windowMs: 60_000, max: 120 },
  { windowMs: 86_400_000, max: 10_000 },
];

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
  private readonly windows = LIMITS.map(() => ({ start: 0, count: 0 }));

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

  retryAfter(now = Date.now()) {
    let wait = 0;
    LIMITS.forEach(({ windowMs, max }, index) => {
      const window = this.windows[index];
      if (now - window.start >= windowMs)
        Object.assign(window, { start: now, count: 0 });
      if (window.count >= max)
        wait = Math.max(
          wait,
          Math.ceil((window.start + windowMs - now) / 1000),
        );
    });
    if (!wait) for (const window of this.windows) window.count++;
    return wait;
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
          ...(changes.fit !== undefined ? { fitDetails: null } : {}),
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

  matchScores() {
    const { enabled, used } = this.matchSettings();
    return {
      enabled,
      usedToday: used,
      dailyLimit: DAILY_SCORES,
    };
  }

  setMatchScores(enabled: boolean) {
    this.ctx.storage.kv.put(MATCH_SCORES, { ...this.matchSettings(), enabled });
    this.changed();
    return this.matchScores();
  }

  async scoreJobs(jobs: JobToScore[]) {
    if (!this.matchSettings().enabled)
      return failure(
        403,
        "match_scores_off",
        "Match scores are turned off for this person. Don't call score_jobs again in this conversation; tell them they can turn on match scores on the Resume page. Don't estimate a match yourself; leave the resume match blank.",
      );
    const resume = this.resume();
    if (!resume)
      return failure(
        409,
        "no_resume",
        "No resume is saved. Ask the person to add one on the Resume page, or call save_resume with resume text they give you, then try again.",
      );
    const keys = await Promise.all(
      jobs.map((job) => scoreKey(resume.text, job.posting)),
    );
    const settings = this.matchSettings();
    const known = this.scoreCache(settings.day);
    const scorable = jobs.filter(
      (job) => !job.applicationId || this.application(job.applicationId),
    );
    const fresh = scorable.filter((job) => !known[keys[jobs.indexOf(job)]]);
    const remaining = Math.max(0, DAILY_SCORES - settings.used);
    if (fresh.length && !remaining && fresh.length === scorable.length)
      return failure(
        429,
        "match_score_daily_limit",
        `All ${DAILY_SCORES} of today's match scores are used; they reset at midnight UTC. Don't call score_jobs again today. Don't estimate a match yourself; leave the resume match blank.`,
      );
    const toScore = fresh.slice(0, remaining);
    this.ctx.storage.kv.put(MATCH_SCORES, {
      ...settings,
      used: settings.used + toScore.length,
    });
    const scored = await Promise.all(
      toScore.map(async (job) => ({
        job,
        result: await askClef(this.env.AI, resume.text, job.posting),
      })),
    );
    const now = this.matchSettings();
    if (now.day === settings.day) {
      const failed = scored.filter(({ result }) => "error" in result).length;
      if (failed)
        this.ctx.storage.kv.put(MATCH_SCORES, {
          ...now,
          used: Math.max(0, now.used - failed),
        });
      const cache = this.scoreCache(now.day);
      for (const { job, result } of scored)
        if (result.match) cache[keys[jobs.indexOf(job)]] = result.match;
      this.ctx.storage.kv.put(SCORE_CACHE, { day: now.day, scores: cache });
    }
    const results = jobs.map((job, index) => {
      const label = job.label;
      if (!scorable.includes(job))
        return { label, error: "Application not found. Check the id." };
      const done = scored.find((entry) => entry.job === job)?.result;
      const match = known[keys[index]] ?? done?.match ?? null;
      if (!match && !done)
        return {
          label,
          error: `Not scored: today's ${DAILY_SCORES} match scores ran out. Don't estimate a match yourself; leave the resume match blank.`,
        };
      if (!match)
        return {
          label,
          error:
            done && "error" in done && done.error === "allowance"
              ? "Not scored: today's shared allowance for match scores is used up; it resets at midnight UTC. Don't call score_jobs again today. Don't estimate a match yourself; leave the resume match blank."
              : "This posting couldn't be scored. Don't retry it. Don't estimate a match yourself; leave the resume match blank.",
        };
      const saved =
        !job.applicationId ||
        this.saveScore(job.applicationId, match, job.posting);
      const outcome = { ...match, rating: matchRating(match.match) };
      return saved
        ? { label, applicationId: job.applicationId ?? null, ...outcome }
        : {
            label,
            ...outcome,
            error:
              "Scored, but the application was deleted before the score could be saved.",
          };
    });
    this.changed();
    return { results, ...this.matchScores() };
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

  private matchSettings(): MatchSettings {
    const today = utcToday();
    const saved = this.ctx.storage.kv.get<MatchSettings>(MATCH_SCORES);
    const enabled = saved?.enabled ?? true;
    return saved?.day === today
      ? { enabled, day: today, used: saved.used }
      : { enabled, day: today, used: 0 };
  }

  private saveScore(id: string, scored: JobMatch, posting: string) {
    const existing = this.application(id);
    if (!existing) return false;
    const { match, ...details } = scored;
    this.db
      .update(applications)
      .set({
        fit: match,
        fitDetails: { ...details, scoredAt: new Date().toISOString() },
        ...((existing.description?.length ?? 0) < posting.length
          ? { description: posting }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(applications.id, id))
      .run();
    return true;
  }

  private scoreCache(day: string): Record<string, JobMatch> {
    const saved = this.ctx.storage.kv.get<{
      day: string;
      scores: Record<string, JobMatch>;
    }>(SCORE_CACHE);
    return saved?.day === day ? { ...saved.scores } : {};
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
