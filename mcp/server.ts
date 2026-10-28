import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { jobSearchServer, unwrap } from "../src/mcp/tools.ts";

const credentials = join(homedir(), ".config/job-search/access.env");
if (existsSync(credentials)) process.loadEnvFile(credentials);

const BASE = (
  process.env.JOB_SEARCH_URL ?? "https://job-search.jarenkempton.dev"
).replace(/\/$/, "");

function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

async function call(path: string, method = "GET", body?: unknown) {
  const id = process.env.CF_ACCESS_CLIENT_ID;
  const secret = process.env.CF_ACCESS_CLIENT_SECRET;
  if (!id || !secret)
    throw new Error(`Missing Access service token. Expected ${credentials}.`);
  const response = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      "cf-access-client-id": id,
      "cf-access-client-secret": secret,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (response.status >= 300 && response.status < 400)
    throw new Error(
      "Cloudflare Access rejected the service token (redirected to login).",
    );
  return unwrap(response);
}

await jobSearchServer(call, localToday).connect(new StdioServerTransport());
