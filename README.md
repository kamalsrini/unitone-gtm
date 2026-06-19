# UnitOne GTM Engine

Signal-based outbound GTM, built as a **5-layer pipeline** running serverless on **Vercel** with **Vercel Postgres**. Create a campaign in the UI and it flows end-to-end: detect signals → score the ICP → find & enrich contacts → generate persona messages → enroll → monitor → triage replies.

## The 5 layers

| # | Layer | What it does | Code |
|---|-------|--------------|------|
| 1 | Signal Detection & Scoring | Live GitHub + Hacker News signals; firmographic/technographic/intent scoring → HOT/WARM/NURTURE/WATCH tiers | `lib/signals.ts`, `lib/scorer.ts`, `lib/config.ts` |
| 2 | Enrollment & Sequencing | Apollo people search + email enrichment + (gated) sequence enrollment | `lib/apollo.ts` |
| 3 | Content & Distribution | Persona-aware message + engagement-asset generation | `lib/messenger.ts` |
| 4 | Attribution & Monitoring | Funnel rollup + Slack snapshots + daily cron | `lib/slack.ts`, `/api/cron/daily` |
| 5 | Response Handling | Instantly reply polling + Claude intent triage + drafted replies | `lib/replies.ts`, `/api/cron/replies` |

## Stack
Next.js 15 (App Router) · TypeScript · Tailwind · `@vercel/postgres` · Vercel Cron.

## Local development
```bash
npm install
cp .env.example .env.local   # fill in keys (see below)
npm run dev                  # http://localhost:3000
```
First load shows an **Initialize database** button — click it (calls `/api/init-db`) to create the schema.

## Environment variables
| Var | Layer | Required | Notes |
|-----|-------|----------|-------|
| `POSTGRES_URL` (+ `POSTGRES_*`) | all | yes | Auto-injected by Vercel Postgres; paste into `.env.local` for local dev |
| `APOLLO_API_KEY` | 2 | for live enroll | People search + enrichment + sequence add |
| `ANTHROPIC_API_KEY` | 5 | for triage | Claude reply classification |
| `INSTANTLY_API_KEY` | 5 | for replies | Inbound reply polling |
| `SLACK_WEBHOOK_URL` | 4 | optional | Snapshot alerts |
| `GITHUB_TOKEN` | 1 | optional | Raises GitHub rate limit (60→5000/hr) |
| `CRON_SECRET` | infra | recommended | Protects `/api/cron/*` and `/api/init-db` |

## Deploy to Vercel
1. Push this repo to GitHub.
2. Import it in Vercel → it auto-detects Next.js.
3. **Storage → Create → Postgres**, attach to the project (injects `POSTGRES_*`).
4. Add the env vars above in **Settings → Environment Variables**.
5. Deploy. Open the app and click **Initialize database**.
6. Crons (`vercel.json`) run automatically: daily pipeline refresh (13:00 UTC) + hourly reply triage.

## Safety
`auto_enroll` is **off by default**. Without it, Layer 2 stages enriched contacts for manual review and **no email is sent**. Turn it on per-campaign (and pick an Apollo sequence) only when you're ready to send live.
