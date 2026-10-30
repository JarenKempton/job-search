import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { Hono } from "hono";
import { applicationRoutes } from "./applications/routes";
import { utcToday } from "./applications/status";
import type { AppEnv, Env } from "./env";
import { requireAccess } from "./lib/cloudflare-access";
import { ApiError, errorResponse, json } from "./lib/http";
import { normalizeError } from "./lib/normalize-error";
import { jobSearchServer, unwrap } from "./mcp/tools";

const SECURITY_HEADERS = {
  "content-security-policy":
    "default-src 'self'; img-src 'self' data:; connect-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "cross-origin-opener-policy": "same-origin",
  "referrer-policy": "no-referrer",
  "strict-transport-security": "max-age=31536000; includeSubDomains",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-robots-tag": "noindex, nofollow",
};

export { Tracker } from "./tracker";

const app = new Hono<AppEnv>();
app.use(async (context, next) => {
  const email = await requireAccess(
    context.req.raw,
    context.env,
    context.executionCtx as ExecutionContext,
  );
  const tracker = context.env.TRACKER.get(
    context.env.TRACKER.idFromName(email),
  );
  const wait = await tracker.retryAfter();
  if (wait)
    return json(
      {
        error: {
          code: "rate_limited",
          message: `Too many requests. Try again in ${wait} seconds.`,
        },
      },
      { status: 429, headers: { "retry-after": String(wait) } },
    );
  context.set("tracker", tracker);
  await next();
});
app.route("/", applicationRoutes);
app.all("/mcp", async (context) => {
  const assertion = context.req.header("cf-access-jwt-assertion");
  const call = async (path: string, method = "GET", body?: unknown) =>
    unwrap(
      await app.request(
        path,
        {
          method,
          headers: {
            ...(assertion ? { "cf-access-jwt-assertion": assertion } : {}),
            ...(body ? { "content-type": "application/json" } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
        },
        context.env,
        context.executionCtx,
      ),
    );
  const transport = new WebStandardStreamableHTTPServerTransport({
    enableJsonResponse: true,
  });
  await jobSearchServer(call, utcToday).connect(transport);
  return transport.handleRequest(context.req.raw);
});
app.all("/api/*", () => {
  throw new ApiError(404, "not_found", "Route not found.");
});
app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));
app.onError((error) => errorResponse(normalizeError(error)));

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const response = await app.fetch(request, env, ctx);
    if (response.webSocket) return response;
    const result = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      result.headers.set(name, value);
    if (new URL(request.url).pathname.startsWith("/api/"))
      result.headers.set("cache-control", "no-store");
    return result;
  },
} satisfies ExportedHandler<Env>;
