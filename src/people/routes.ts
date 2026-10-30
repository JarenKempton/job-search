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
import { sendInvite } from "./invite";

const personSchema = z.object({
  email: z
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
});

export const isAdmin = (env: Env, email: string) =>
  (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((admin) => admin.trim().toLowerCase())
    .includes(email);

async function people(env: Env, members: string[]) {
  const visits = await directory(env).visits();
  return [...new Set([...members, ...Object.keys(visits)])]
    .sort()
    .map((email) => ({
      email,
      member: members.includes(email),
      firstSeen: visits[email]?.firstSeen ?? null,
      lastSeen: visits[email]?.lastSeen ?? null,
    }));
}

const invite = (context: Context<AppEnv>, to: string) =>
  sendInvite(context.env, {
    to,
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
  .get("/api/v1/people", async (context) => {
    const configured = groupConfigured(context.env);
    const members = configured ? await groupEmails(context.env) : [];
    return ok({ configured, people: await people(context.env, members) });
  })
  .post("/api/v1/people", async (context) => {
    requireGroup(context.env);
    const { email } = personSchema.parse(await readJson(context.req.raw));
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
