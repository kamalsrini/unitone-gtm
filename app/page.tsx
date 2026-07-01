"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Stat, StatusBadge, TierChip, EmptyState, FunnelBar } from "./components/ui";

type Campaign = any;

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [metrics, setMetrics] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [needsInit, setNeedsInit] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    const [c, m, s] = await Promise.all([
      fetch("/api/campaigns").then((r) => r.json()),
      fetch("/api/metrics").then((r) => r.json()),
      fetch("/api/status").then((r) => r.json()),
    ]);
    setCampaigns(c.campaigns ?? []);
    setMetrics(m);
    setStatus(s);
    setNeedsInit(!!c.needsInit || !!m.needsInit);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function initDb() {
    await fetch("/api/init-db", { method: "POST" });
    setNeedsInit(false);
    load();
  }

  const t = metrics?.totals ?? {};
  const max = Math.max(t.accounts ?? 1, 1);

  return (
    <div className="space-y-7">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">GTM Command Center</h1>
          <p className="mt-1 text-sm text-muted">Signal-based outbound across the full 5-layer pipeline.</p>
        </div>
        <Link href="/campaigns/new" className="btn-primary">+ New Campaign</Link>
      </div>

      {status && <IntegrationBar status={status} />}

      {needsInit && (
        <div className="card flex items-center justify-between border-warm/40 bg-warm/5 p-4">
          <div>
            <div className="font-medium text-warm">Database not initialized</div>
            <div className="text-sm text-muted">Create the Postgres schema to start tracking campaigns.</div>
          </div>
          <button onClick={initDb} className="btn-primary">Initialize database</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Campaigns" value={metrics?.campaigns ?? 0} sub={`${metrics?.activeCampaigns ?? 0} active`} />
        <Stat label="Accounts scored" value={t.accounts ?? 0} accent="text-accent" />
        <Stat label="Signals detected" value={t.signals ?? 0} accent="text-accent2" />
        <Stat label="Meetings booked" value={t.meetings ?? 0} accent="text-ok" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Outbound Funnel</h2>
          <div className="space-y-3">
            <FunnelBar label="Accounts scored" value={t.accounts ?? 0} max={max} color="#5b8cff" />
            <FunnelBar label="Contacts found" value={t.contacts ?? 0} max={max} color="#22d3ee" />
            <FunnelBar label="Enrolled" value={t.enrolled ?? 0} max={max} color="#7c5bff" />
            <FunnelBar label="Emails sent" value={t.sent ?? 0} max={max} color="#2dd4a7" />
            <FunnelBar label="Replies" value={t.replies ?? 0} max={max} color="#ffb020" />
            <FunnelBar label="Meetings" value={t.meetings ?? 0} max={max} color="#ff5470" />
          </div>
        </div>
        <div className="card p-5">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Tier Distribution</h2>
          <div className="space-y-2.5">
            {["TIER 1 — HOT", "TIER 2 — WARM", "TIER 3 — NURTURE", "TIER 4 — WATCH"].map((tier) => (
              <div key={tier} className="flex items-center justify-between">
                <TierChip tier={tier} />
                <span className="text-lg font-semibold">{metrics?.tiers?.[tier] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Campaigns</h2>
        {loading ? (
          <div className="card p-8 text-center text-muted">Loading…</div>
        ) : campaigns.length === 0 ? (
          <EmptyState title="No campaigns yet" body="Spin up your first signal-based outbound campaign. It flows through all five layers automatically." cta={{ href: "/campaigns/new", label: "Create your first campaign" }} />
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="card group p-4 transition-colors hover:border-accent/50">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white group-hover:text-accent">{c.name}</span>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={c.status} />
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (confirm(`Delete "${c.name}"? This removes it from the dashboard (your Instantly campaign is unaffected).`)) fetch(`/api/delete-campaign?id=${c.id}&force=1`).then(() => load()); }}
                      className="rounded-md border border-hot/40 px-2 py-0.5 text-[11px] text-hot hover:bg-hot/10">Delete</button>
                  </div>
                </div>
                <div className="mt-1 text-xs text-muted capitalize">{String(c.persona).replace("_", " ")} · {c.channel}</div>
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  <MiniStat n={c.stats?.accounts} l="acct" />
                  <MiniStat n={c.stats?.hot} l="hot" accent="text-hot" />
                  <MiniStat n={c.stats?.enrolled} l="enrl" />
                  <MiniStat n={c.stats?.replies} l="reply" accent="text-ok" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ n, l, accent }: { n?: number; l: string; accent?: string }) {
  return (
    <div>
      <div className={`text-base font-semibold ${accent ?? "text-white"}`}>{n ?? 0}</div>
      <div className="label">{l}</div>
    </div>
  );
}

function IntegrationBar({ status }: { status: any }) {
  const items = [
    { k: "postgres", l: "Postgres" }, { k: "apollo", l: "Apollo" },
    { k: "anthropic", l: "Claude" }, { k: "instantly", l: "Instantly" },
    { k: "slack", l: "Slack" }, { k: "github", l: "GitHub" },
  ];
  return (
    <div className="card flex flex-wrap items-center gap-2 p-3">
      <span className="label mr-1">Integrations</span>
      {items.map((i) => (
        <span key={i.k} className={`chip ${status[i.k] ? "bg-ok/15 text-ok" : "bg-watch/10 text-watch"}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${status[i.k] ? "bg-ok" : "bg-watch"}`} />{i.l}
        </span>
      ))}
    </div>
  );
}
