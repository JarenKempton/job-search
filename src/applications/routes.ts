import { Hono } from "hono";
import type { AppEnv } from "../env";
import { ApiError, ok, readJson } from "../lib/http";
import { requireUuid } from "../lib/query";
import { toCsv } from "./csv";
import { utcToday } from "./status";
import {
  createApplicationSchema,
  createEventSchema,
  matchSettingsSchema,
  resumeSchema,
  scoreJobSchema,
  updateApplicationSchema,
} from "./validation";

function orFail<T extends object>(
  result: T | { failure: { status: number; code: string; message: string } },
): T {
  if ("failure" in result) {
    const { status, code, message } = result.failure;
    throw new ApiError(status, code, message);
  }
  return result;
}

function notFound(): never {
  throw new ApiError(404, "application_not_found", "Application not found.");
}

export const applicationRoutes = new Hono<AppEnv>()
  .get("/api/v1/applications", async (context) =>
    ok(await context.var.tracker.list("updated")),
  )
  .get("/api/v1/applications.csv", async (context) => {
    const rows = await context.var.tracker.list("created");
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
    return ok(await context.var.tracker.create(input, today), { status: 201 });
  })
  .get("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    return ok((await context.var.tracker.find(id)) ?? notFound());
  })
  .patch("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const { today = utcToday(), ...input } = updateApplicationSchema.parse(
      await readJson(context.req.raw),
    );
    const updated =
      (await context.var.tracker.update(id, input, today)) ?? notFound();
    if ("benefitsError" in updated)
      throw new ApiError(422, "validation_error", updated.benefitsError);
    return ok(updated);
  })
  .delete("/api/v1/applications/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    if (!(await context.var.tracker.remove(id))) notFound();
    return ok({ id });
  })
  .post("/api/v1/applications/:id/events", async (context) => {
    const id = requireUuid(context.req.param("id"), "Application");
    const input = createEventSchema.parse(await readJson(context.req.raw));
    const event = await context.var.tracker.addEvent(id, input);
    return ok(event ?? notFound(), { status: 201 });
  })
  .delete("/api/v1/events/:id", async (context) => {
    const id = requireUuid(context.req.param("id"), "Event");
    const deleted = await context.var.tracker.removeEvent(id);
    if (!deleted)
      throw new ApiError(404, "event_not_found", "Event not found.");
    return ok(deleted);
  })
  .get("/api/v1/resume", async (context) =>
    ok(await context.var.tracker.resume()),
  )
  .put("/api/v1/resume", async (context) =>
    ok(
      await context.var.tracker.saveResume(
        resumeSchema.parse(await readJson(context.req.raw)),
      ),
    ),
  )
  .delete("/api/v1/resume", async (context) =>
    ok({ removed: await context.var.tracker.removeResume() }),
  )
  .get("/api/v1/match-scores/settings", async (context) =>
    ok(await context.var.tracker.matchScores()),
  )
  .put("/api/v1/match-scores/settings", async (context) => {
    const { enabled } = matchSettingsSchema.parse(
      await readJson(context.req.raw),
    );
    return ok(await context.var.tracker.setMatchScores(enabled));
  })
  .post("/api/v1/match-scores", async (context) => {
    const {
      posting,
      applicationId,
      today = utcToday(),
    } = scoreJobSchema.parse(await readJson(context.req.raw));
    return ok(
      orFail(
        await context.var.tracker.scoreJob(
          posting,
          applicationId ?? null,
          today,
        ),
      ),
    );
  })
  .get("/api/v1/live", (context) => {
    if (context.req.header("upgrade")?.toLowerCase() !== "websocket")
      throw new ApiError(
        426,
        "upgrade_required",
        "Expected a WebSocket upgrade.",
      );
    const origin = context.req.header("origin");
    if (origin && origin !== new URL(context.req.url).origin)
      throw new ApiError(403, "forbidden_origin", "Origin is not allowed.");
    return context.var.tracker.fetch(context.req.raw);
  });
