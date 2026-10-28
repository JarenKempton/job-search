<img src="assets/icon.svg" width="64" height="64" alt="">

# Job Search

Private job-application tracker at `job-search.jarenkempton.dev`: a Cloudflare Worker serving a React app and a JSON API over D1, behind Cloudflare Access.

Tracks per application: company, role, posting URL, source, how to apply, what they ask for (resume, cover letter, portfolio, questions, take-home…), resume version sent, salary range, years asked, fit %, interest, status, applied / heard-back / follow-up dates, contact, notes, the pasted job description, and a timeline of calls and interviews. The dashboard shows response and interview rates, which sources get replies, follow-ups due, and the best-fit jobs not yet applied to. Export everything from **Applications → CSV**.

## Develop

```sh
pnpm install
pnpm db:migrate:local
pnpm dev
```

Local requests use Wrangler's Access mock (`developer@localhost`).

## One-time production setup

1. `pnpm exec wrangler d1 create job-search` and put the returned `database_id` in `wrangler.jsonc`.
2. Zero Trust → Access → Applications → add a self-hosted app for `job-search.jarenkempton.dev` (whole hostname) with an Allow policy for your email only. Put its **Application Audience (AUD) tag** in `ACCESS_AUD` in `wrangler.jsonc`.
3. Create a GitHub environment `production` with `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` (Workers deploy + routes, D1 edit).

After that, every green CI run on `main` applies migrations and deploys. `pnpm run deploy` does the same from your machine.

The Worker refuses every request without a verified Access JWT for that audience, so a misconfigured Access app fails closed.

## Claude (MCP)

`mcp/server.ts` is a stdio MCP server with `list_applications`, `get_application`, `add_application`, `update_application` and `log_event`. It calls the live API with a Cloudflare Access service token read from `~/.config/job-search/access.env` (`CF_ACCESS_CLIENT_ID`, `CF_ACCESS_CLIENT_SECRET`). The Worker accepts only the service token whose client ID is `ACCESS_SERVICE_CLIENT_ID` in `wrangler.jsonc`, and only on `/api/*`.

```sh
claude mcp add job-search -s user -- node /home/jaren/.t3/projects/job-search/mcp/server.ts
```

## ChatGPT (remote MCP)

The Worker serves the same tools over Streamable HTTP at `https://job-search.jarenkempton.dev/mcp`, defined once in `src/mcp/tools.ts`. Sign-in is Cloudflare Access Managed OAuth, so the same Allow policy as the dashboard applies and the Worker sees an ordinary Access JWT.

1. Zero Trust → Access controls → Applications → the `job-search.jarenkempton.dev` app → Edit → Advanced settings → turn on **Managed OAuth**, enable dynamic client registration, and allow the redirect URI `https://chatgpt.com/*`.
2. ChatGPT web → Plugins → **+** → Add custom MCP server → URL `https://job-search.jarenkempton.dev/mcp`, authentication **OAuth** → sign in with Access.

## Checks

```sh
pnpm format:check && pnpm check && pnpm test && pnpm deploy:check
```

## Makayla’s instance

`makayla-jobs.jarenkempton.dev` runs the same code in a separate Worker (`makayla-jobs`) with its own D1 database. `wrangler.makayla.jsonc` holds its bindings and Access audience. Neither instance shares application records or service-token access. Both instances deploy after green CI on `main`.

The hostname needs its own Cloudflare Access self-hosted application covering the entire hostname. Allow only Makayla’s email and Jaren’s email. Enable Managed OAuth and allow redirect URI `https://chatgpt.com/*`. Copy this application’s AUD into `ACCESS_AUD` in `wrangler.makayla.jsonc` before deployment. Do not reuse the original application’s AUD or expand its policy.

- Dashboard: `https://makayla-jobs.jarenkempton.dev`
- Remote MCP: `https://makayla-jobs.jarenkempton.dev/mcp` (OAuth)
- Build/dry-run: `pnpm deploy:check:makayla`
- Deploy/migrate only her instance: `pnpm deploy:makayla`

The Vite build selects her config when `JOB_SEARCH_INSTANCE=makayla`; the default remains Jaren’s instance. Wrangler deploy uses the config emitted by that build.
