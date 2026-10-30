import type { Env } from "../env";
import { ApiError } from "../lib/http";

type Rule = { email?: { email: string } } & Record<string, unknown>;
type Group = {
  name: string;
  include: Rule[];
  exclude?: Rule[];
  require?: Rule[];
};

export const groupConfigured = (env: Env) =>
  Boolean(
    env.CLOUDFLARE_ACCOUNT_ID && env.ACCESS_GROUP_ID && env.ACCESS_GROUPS_TOKEN,
  );

async function access<T>(
  env: Env,
  path: string,
  method: "GET" | "PUT" | "POST",
  body?: unknown,
) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/access/${path}`,
    {
      method,
      headers: {
        authorization: `Bearer ${env.ACCESS_GROUPS_TOKEN}`,
        ...(body ? { "content-type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    result?: T;
    errors?: { message: string }[];
  };
  if (!response.ok || !payload.success || payload.result === undefined)
    throw new ApiError(
      502,
      "access_group_failed",
      `Cloudflare Access didn't accept the change: ${payload.errors?.[0]?.message ?? response.status}`,
    );
  return payload.result;
}

const request = (env: Env, method: "GET" | "PUT", body?: Group) =>
  access<Group>(env, `groups/${env.ACCESS_GROUP_ID}`, method, body);

export async function revokeSessions(env: Env, email: string) {
  try {
    await access(env, "organizations/revoke_user", "POST", { email });
    return true;
  } catch {
    return false;
  }
}

const emailsIn = (group: Group) =>
  group.include.flatMap((rule) =>
    rule.email ? [rule.email.email.toLowerCase()] : [],
  );

export async function groupEmails(env: Env) {
  return emailsIn(await request(env, "GET"));
}

export async function changeGroup(
  env: Env,
  change: (emails: string[]) => string[],
) {
  const group = await request(env, "GET");
  const emails = change(emailsIn(group));
  const updated = await request(env, "PUT", {
    name: group.name,
    include: [
      ...group.include.filter((rule) => !rule.email),
      ...emails.map((email) => ({ email: { email } })),
    ],
    exclude: group.exclude ?? [],
    require: group.require ?? [],
  });
  return emailsIn(updated);
}
