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

After that, every green CI run on `main` applies migrations and deploys. `pnpm deploy` does the same from your machine.

The Worker refuses every request without a verified Access JWT for that audience, so a misconfigured Access app fails closed.

## Checks

```sh
pnpm format:check && pnpm check && pnpm test && pnpm deploy:check
```
