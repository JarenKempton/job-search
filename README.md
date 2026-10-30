<img src="assets/icon.svg" width="64" height="64" alt="">

# Job Search

Private job-application tracker at `job-search.jarenkempton.dev` for a small invited group: one Cloudflare Worker serving a React app, a JSON API and an MCP server, behind Cloudflare Access. Each person’s data lives in their own SQLite-backed Durable Object.

Tracks per application: company, role, posting URL, source, how to apply, what they ask for (resume, cover letter, portfolio, questions, take-home…), resume version sent, salary range, years asked, fit %, interest, status, applied / heard-back / follow-up dates, contact, notes, the pasted job description, and a timeline of calls and interviews. The dashboard shows response and interview rates, which sources get replies, follow-ups due, and the best-fit jobs not yet applied to. Export everything from **Applications → CSV**.

## How people are kept apart

The Worker reads the email from the verified Cloudflare Access login, lowercases it, and opens the Durable Object `TRACKER.idFromName(email)`. Nothing the client sends picks the object. The REST API, `/mcp` and `/api/v1/live` all go through that one path, so a person can only ever reach their own applications and events. Requests without a verified Access identity get a 401. Service tokens carry no email, so they are refused.

Each object runs its drizzle migrations once at startup inside `blockConcurrencyWhile`, and the Worker calls it through typed RPC methods.

## Live updates

`GET /api/v1/live` upgrades to a WebSocket for the signed-in person. After any create, update or delete of that person’s applications or events, through REST or MCP, the server sends the text message `{"type":"changed"}` to each of their open tabs. The socket uses the Hibernation API, so idle tabs cost no duration. A `ping` text message gets `pong` without waking the object. A cross-site `Origin` is refused.

## Develop

```sh
pnpm install
pnpm dev
```

Local requests use Wrangler’s Access mock (`developer@localhost`).

## Access setup (dashboard, one time)

One Access application covers everyone:

1. Zero Trust → Settings → Authentication → Login methods → **Add new → Google**. Follow the OAuth client steps there. Keep One-time PIN as a fallback if you want it.
2. Zero Trust → Access controls → Applications → the self-hosted app for `job-search.jarenkempton.dev` (whole hostname) → **Login methods**: select Google (and One-time PIN if kept).
3. **Policies**: one Allow policy with the Include rule **Emails**, listing each person’s address. Remove any service-token or Bypass policy. Delete the `job-search-mcp` service token under Access → Service credentials.
4. **Advanced settings → Managed OAuth**: turn it on, enable dynamic client registration, and allow the redirect URIs `https://chatgpt.com/*`, `https://claude.ai/*` and `http://localhost:*` (Claude Code).
5. Keep the app’s **Application Audience (AUD) tag** in `ACCESS_AUD` in `wrangler.jsonc`.

**Adding a friend:** add their email to the Allow policy. They sign in with Google, and their tracker is created empty on first use. No deploy is needed.

A GitHub environment `production` holds `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Workers deploy and routes). Every green CI run on `main` deploys. `pnpm run deploy` does the same from your machine.

## MCP (Claude and ChatGPT)

The Worker serves `list_applications`, `get_application`, `add_application`, `update_application`, `log_event` and `delete_application` over Streamable HTTP at `https://job-search.jarenkempton.dev/mcp`, defined once in `src/mcp/tools.ts`. Sign-in is Access Managed OAuth, so the same email policy applies and each person sees only their own data.

- Claude Code: `claude mcp add --transport http job-search https://job-search.jarenkempton.dev/mcp`, then `/mcp` → authenticate.
- ChatGPT web → Plugins → **+** → Add custom MCP server → URL `https://job-search.jarenkempton.dev/mcp`, authentication **OAuth** → sign in with Access.

`mcp/server.ts` is the same toolset over stdio. It signs each call with your own Access login from `cloudflared access login https://job-search.jarenkempton.dev`.

## Free-plan limits (SQLite-backed Durable Objects)

From the [pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/) and [limits](https://developers.cloudflare.com/durable-objects/platform/limits/) pages, checked 2026-10-29:

| Limit                                                                             | Workers Free                            |
| --------------------------------------------------------------------------------- | --------------------------------------- |
| Requests (each RPC call, each WebSocket connect; incoming WS messages count 20:1) | 100,000 / day                           |
| Duration (hibernated sockets are not billed)                                      | 13,000 GB-s / day                       |
| SQLite rows read                                                                  | 5 million / day                         |
| SQLite rows written                                                               | 100,000 / day                           |
| Stored data, whole account                                                        | 5 GB                                    |
| Storage per object                                                                | 1 GB per the FAQ (the table says 10 GB) |
| Durable Object classes                                                            | 100                                     |

Going over a daily limit makes further calls of that type fail until 00:00 UTC. It does not bill. One API call is one Worker request plus one Durable Object request, so 20 people stay far below these numbers.

## Checks

```sh
pnpm format:check && pnpm check && pnpm test && pnpm deploy:check
```

## Benefits

Each application has an optional **Benefits** section for vacation/PTO and rollover, sick leave, holidays, medical/dental/vision coverage and costs, retirement match and vesting, parental leave, other perks, notes, and the information source. Use text to preserve policy details; leave unknown benefits blank. These fields are included in CSV exports and available through both MCP transports with `add_application`, `update_application`, and `get_application`. Omitted fields stay unchanged on update; send `null` to clear a benefits field.

Example: “Update Acme: 20 vacation days, healthcare starts day one, 4% retirement match; source: recruiter email today.”
