import { utcToday } from "../applications/status";
import type { Env } from "../env";
import { ApiError } from "../lib/http";
import { MATCH_GATEWAY } from "../match";

export const FREE_DAILY_DOLLARS = (10_000 / 1_000) * 0.011;

type Gateway = Record<string, unknown> & {
  spend_limits?: { enabled?: boolean; rules?: { limit: number }[] };
};

export const spendConfigured = (env: Env) =>
  Boolean(env.CLOUDFLARE_ACCOUNT_ID && env.AI_GATEWAY_TOKEN);

async function cloudflare<T>(env: Env, path: string, init: RequestInit = {}) {
  const response = await fetch(`https://api.cloudflare.com/client/v4/${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.AI_GATEWAY_TOKEN}`,
      "content-type": "application/json",
    },
  });
  const payload = (await response.json().catch(() => ({}))) as T & {
    success?: boolean;
    errors?: { message: string }[] | null;
  };
  if (!response.ok || payload.errors?.length)
    throw new ApiError(
      502,
      "ai_gateway_failed",
      `Cloudflare didn't return AI usage: ${payload.errors?.[0]?.message ?? response.status}`,
    );
  return payload;
}

const gatewayPath = (env: Env) =>
  `accounts/${env.CLOUDFLARE_ACCOUNT_ID}/ai-gateway/gateways/${MATCH_GATEWAY}`;

async function gateway(env: Env) {
  return (await cloudflare<{ result: Gateway }>(env, gatewayPath(env))).result;
}

async function spentToday(env: Env) {
  const now = new Date(Date.now() + 3_600_000).toISOString();
  const query = `{ viewer { accounts(filter: { accountTag: "${env.CLOUDFLARE_ACCOUNT_ID}" }) { aiGatewayRequestsAdaptiveGroups(limit: 100, filter: { datetimeHour_geq: "${utcToday()}T00:00:00Z", datetimeHour_leq: "${now}", gateway: "${MATCH_GATEWAY}" }) { sum { cost } } } } }`;
  const { data } = await cloudflare<{
    data: {
      viewer: {
        accounts: {
          aiGatewayRequestsAdaptiveGroups: { sum: { cost: number } }[];
        }[];
      };
    };
  }>(env, "graphql", { method: "POST", body: JSON.stringify({ query }) });
  return data.viewer.accounts[0].aiGatewayRequestsAdaptiveGroups.reduce(
    (total, group) => total + group.sum.cost,
    0,
  );
}

export async function aiSpend(env: Env) {
  const [spent, current] = await Promise.all([spentToday(env), gateway(env)]);
  return {
    spentToday: spent,
    freeToday: FREE_DAILY_DOLLARS,
    ceiling: current.spend_limits?.rules?.[0]?.limit ?? null,
  };
}

export async function setCeiling(env: Env, ceiling: number) {
  const current = await gateway(env);
  const rules = current.spend_limits?.rules ?? [];
  if (!rules.length)
    throw new ApiError(
      409,
      "no_spend_limit",
      "The job-search AI Gateway has no spend limit to change.",
    );
  const { id, created_at, modified_at, ...settings } = current;
  await cloudflare(env, gatewayPath(env), {
    method: "PUT",
    body: JSON.stringify({
      ...settings,
      spend_limits: {
        ...current.spend_limits,
        rules: rules.map((rule, index) =>
          index === 0 ? { ...rule, limit: ceiling } : rule,
        ),
      },
    }),
  });
  return aiSpend(env);
}
