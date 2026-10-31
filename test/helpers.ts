import { env } from "cloudflare:test";
import { expect } from "vite-plus/test";
import type { Env } from "../src/env";
import worker from "../src/worker";

const workerFetch = worker.fetch as (
  request: Request,
  env: Env,
  ctx: ExecutionContext,
) => Promise<Response>;

export function signedInAs(email: string): ExecutionContext {
  return {
    access: { aud: "test-audience", getIdentity: async () => ({ email }) },
  } as unknown as ExecutionContext;
}

const signedIn = signedInAs("jaren@example.test");

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

export async function rpc(
  method: string,
  params: Record<string, unknown> = {},
  ctx: ExecutionContext = signedIn,
) {
  const response = await call(
    "/mcp",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    },
    ctx,
  );
  expect(response.status).toBe(200);
  return ((await response.json()) as { result: Record<string, unknown> })
    .result;
}
