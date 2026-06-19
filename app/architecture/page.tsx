import Link from "next/link";

const LAYERS = [
  { n: 1, title: "Signal Detection & Scoring", color: "#22d3ee",
    body: "Live signals from GitHub (security repo/issue activity) and Hacker News (Algolia). Each named account is scored on firmographic (0–40), technographic (0–30), and intent (0–30) dimensions, then bucketed into HOT / WARM / NURTURE / WATCH tiers.",
    files: "lib/signals.ts · lib/scorer.ts · lib/config.ts" },
  { n: 2, title: "Enrollment & Sequence Execution", color: "#5b8cff",
    body: "Apollo search finds decision-makers at HOT/WARM accounts, enriches verified emails, and (optionally) enrolls them into a live Apollo sequence. Auto-enroll is gated behind an explicit toggle so nothing sends by accident.",
    files: "lib/apollo.ts" },
  { n: 3, title: "Content & Distribution", color: "#7c5bff",
    body: "Persona-aware message generation (VP Eng / CTO / CFO / CEO), each with subject lines, email body, LinkedIn opener, and a persona-specific engagement asset — personalized with the strongest detected signal.",
    files: "lib/messenger.ts" },
  { n: 4, title: "Attribution & Monitoring", color: "#2dd4a7",
    body: "Every run rolls up into a funnel (scored → contacts → enrolled → sent → replies → meetings). Snapshots post to Slack. A daily Vercel Cron re-runs active campaigns to refresh signals and metrics.",
    files: "lib/slack.ts · lib/db.ts · /api/cron/daily" },
  { n: 5, title: "Response Handling & Follow-up", color: "#ffb020",
    body: "An hourly cron polls Instantly for inbound replies, classifies intent with Claude (meeting / question / not-interested / OOO / auto), and drafts a suggested response for one-click human approval. Never auto-sends to prospects.",
    files: "lib/replies.ts · /api/cron/replies" },
];

export default function Architecture() {
  return (
    <div className="space-y-7">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">5-Layer Architecture</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          The full GTM engine, ported to TypeScript and running serverless on Vercel with Postgres state.
          A campaign created on the dashboard flows top-to-bottom through these five layers.
        </p>
      </div>
      <div className="space-y-3">
        {LAYERS.map((l) => (
          <div key={l.n} className="card flex gap-4 p-5">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-lg font-bold text-white"
              style={{ background: `${l.color}22`, color: l.color, border: `1px solid ${l.color}55` }}>{l.n}</div>
            <div>
              <h2 className="font-semibold text-white">{l.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">{l.body}</p>
              <code className="mt-2 inline-block rounded bg-ink/60 px-2 py-1 text-xs text-accent2">{l.files}</code>
            </div>
          </div>
        ))}
      </div>
      <div className="card p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Data flow</h2>
        <p className="mt-2 font-mono text-sm text-accent">
          create campaign → L1 signals+score → L2 Apollo enrich/enroll → L3 messages → L4 monitor/Slack → L5 reply triage
        </p>
      </div>
      <Link href="/campaigns/new" className="btn-primary">+ Create a campaign</Link>
    </div>
  );
}
