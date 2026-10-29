import { execFileSync } from "node:child_process";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { jobSearchServer, unwrap } from "../src/mcp/tools.ts";

const BASE = (
  process.env.JOB_SEARCH_URL ?? "https://job-search.jarenkempton.dev"
).replace(/\/$/, "");

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function accessToken(): string {
  return execFileSync("cloudflared", ["access", "token", `-app=${BASE}`], {
    encoding: "utf8",
  }).trim();
}

async function call(path: string, method = "GET", body?: unknown) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      "cf-access-token": accessToken(),
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error(
      `Cloudflare Access needs a sign-in. Run: cloudflared access login ${BASE}`,
    );
  return unwrap(response);
}

await jobSearchServer(call, localToday).connect(new StdioServerTransport());
