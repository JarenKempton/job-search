import { Hono } from "hono";
import { applicationRoutes } from "./applications/routes";
import type { AppEnv, Env } from "./env";
import { mayAccess, requireAccess } from "./lib/cloudflare-access";
import { ApiError, errorResponse } from "./lib/http";
import { normalizeError } from "./lib/normalize-error";

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

const app = new Hono<AppEnv>();
app.route("/", applicationRoutes);
app.all("/api/*", () => {
  throw new ApiError(404, "not_found", "Route not found.");
});
app.all("*", (context) => context.env.ASSETS.fetch(context.req.raw));
app.onError((error) => errorResponse(normalizeError(error)));

export default {
  async fetch(request, env, ctx): Promise<Response> {
    let response: Response;
    try {
      const principal = await requireAccess(request, env, ctx);
      if (!mayAccess(principal, env, new URL(request.url).pathname))
        throw new ApiError(
          403,
          "forbidden",
          "This client may not access that.",
        );
      response = await app.fetch(request, env);
    } catch (error) {
      response = errorResponse(error);
    }
    const result = new Response(response.body, response);
    for (const [name, value] of Object.entries(SECURITY_HEADERS))
      result.headers.set(name, value);
    if (new URL(request.url).pathname.startsWith("/api/"))
      result.headers.set("cache-control", "no-store");
    return result;
  },
} satisfies ExportedHandler<Env>;
