import { env } from "cloudflare:test";
import type { Env } from "../src/env";
import worker from "../src/worker";

const workerFetch = worker.fetch as (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Promise<Response>;

const signedIn = {
  access: {
    aud: "test-audience",
    getIdentity: async () => ({ email: "jaren@example.test" }),
  },
} as unknown as ExecutionContext;

export function call(
  path: string,
  init: RequestInit & { json?: unknown } = {},
  ctx: ExecutionContext = signedIn,
): Promise<Response> {
  const { json, ...rest } = init;
  return workerFetch(
    new Request(`https://example.test${path}`, {
      ...rest,
      ...(json !== undefined
        ? {
            body: JSON.stringify(json),
            headers: { "content-type": "application/json" },
          }
        : {}),
    }),
    env as unknown as Env,
    ctx,
  );
}

export async function data<T = Record<string, unknown>>(
  response: Response,
): Promise<T> {
  return ((await response.json()) as { data: T }).data;
}
