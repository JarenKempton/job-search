import { Hono, type Context, type MiddlewareHandler } from "hono";
import { z } from "zod";
import type { AppEnv, Env } from "../env";
import { ApiError, ok, readJson } from "../lib/http";
import {
  changeGroup,
  groupConfigured,
  groupEmails,
  revokeSessions,
} from "./access-group";
import { directory } from "./directory";
import { aiSpend, setCeiling, spendConfigured } from "./ai-spend";
import { sendInvite } from "./invite";

const nameSchema = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .optional()
  .transform((name) => name || null);

const personSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  name: nameSchema,
});

const extraSchema = z.object({ scores: z.number().int().min(1).max(500) });
const ceilingSchema = z.object({ ceiling: z.number().min(0.25).max(50) });

const tracker = (env: Env, email: string) =>
  env.TRACKER.get(env.TRACKER.idFromName(email));

export const isAdmin = (env: Env, email: string) =>
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((admin) => admin.trim().toLowerCase())
    .includes(email);

async function people(env: Env, members: string[]) {
  const [visits, names] = await Promise.all([
    directory(env).visits(),
    directory(env).names(),
  ]);
  const emails = [...new Set([...members, ...Object.keys(visits)])].sort();
  return Promise.all(
    emails.map(async (email) => ({
      email,
      name: names[email] ?? null,
      member: members.includes(email),
      firstSeen: visits[email]?.firstSeen ?? null,
      lastSeen: visits[email]?.lastSeen ?? null,
      scores: visits[email] ? await tracker(env, email).matchScores() : null,
    })),
  );
}

async function everyone(env: Env) {
  const configured = groupConfigured(env);
  const members = configured ? await groupEmails(env) : [];
  return { configured, people: await people(env, members) };
}

const invite = async (context: Context<AppEnv>, to: string) =>
  sendInvite(context.env, {
    to,
    name: (await directory(context.env).names())[to] ?? null,
    invitedBy: context.var.email,
    origin: new URL(context.req.url).origin,
  });

function requireGroup(env: Env) {
  if (!groupConfigured(env))
    throw new ApiError(
      503,
      "access_group_not_configured",
      "Adding people isn't set up yet.",
    );
}

const adminOnly: MiddlewareHandler<AppEnv> = async (context, next) => {
  if (!isAdmin(context.env, context.var.email))
    throw new ApiError(403, "admin_only", "Only the app owner can do this.");
  await next();
};

export const peopleRoutes = new Hono<AppEnv>()
  .get("/api/v1/me", (context) =>
    ok({
      email: context.var.email,
      admin: isAdmin(context.env, context.var.email),
    }),
  )
  .use("/api/v1/people", adminOnly)
  .use("/api/v1/people/*", adminOnly)
  .use("/api/v1/ai-usage", adminOnly)
  .get("/api/v1/ai-usage", async (context) =>
    ok(
      spendConfigured(context.env)
        ? { configured: true, ...(await aiSpend(context.env)) }
        : { configured: false },
    ),
  )
  .put("/api/v1/ai-usage", async (context) => {
    if (!spendConfigured(context.env))
      throw new ApiError(
        503,
        "ai_usage_not_configured",
        "AI usage isn't set up yet.",
      );
    const { ceiling } = ceilingSchema.parse(await readJson(context.req.raw));
    return ok({
      configured: true,
      ...(await setCeiling(context.env, ceiling)),
    });
  })
  .get("/api/v1/people", async (context) => ok(await everyone(context.env)))
  .patch("/api/v1/people/:email", async (context) => {
    const email = context.req.param("email").toLowerCase();
    const { name } = z
      .object({ name: nameSchema })
      .parse(await readJson(context.req.raw));
    await directory(context.env).rename(email, name);
    return ok(await everyone(context.env));
  })
  .post("/api/v1/people/:email/reset", async (context) => {
    await tracker(
      context.env,
      context.req.param("email").toLowerCase(),
    ).resetMatchScores();
    return ok(await everyone(context.env));
  })
  .post("/api/v1/people/:email/extra", async (context) => {
    const { scores } = extraSchema.parse(await readJson(context.req.raw));
    await tracker(
      context.env,
      context.req.param("email").toLowerCase(),
    ).allowExtraScores(scores);
    return ok(await everyone(context.env));
  })
  .post("/api/v1/people", async (context) => {
    requireGroup(context.env);
    const { email, name } = personSchema.parse(await readJson(context.req.raw));
    if (name) await directory(context.env).rename(email, name);
    const members = await changeGroup(context.env, (emails) =>
      emails.includes(email) ? emails : [...emails, email],
    );
    return ok({
      configured: true,
      people: await people(context.env, members),
      invited: await invite(context, email),
    });
  })
  .post("/api/v1/people/:email/invite", async (context) => {
    requireGroup(context.env);
    const email = context.req.param("email").toLowerCase();
    const members = await groupEmails(context.env);
    if (!members.includes(email))
      throw new ApiError(404, "person_not_found", "That email isn't added.");
    return ok({
      configured: true,
      people: await people(context.env, members),
      invited: await invite(context, email),
    });
  })
  .delete("/api/v1/people/:email", async (context) => {
    requireGroup(context.env);
    const email = context.req.param("email").toLowerCase();
    if (email === context.var.email)
      throw new ApiError(
        400,
        "cannot_remove_self",
        "You can't remove yourself.",
      );
    const members = await changeGroup(context.env, (emails) =>
      emails.filter((member) => member !== email),
    );
    return ok({
      configured: true,
      people: await people(context.env, members),
      signedOut: await revokeSessions(context.env, email),
    });
  });
