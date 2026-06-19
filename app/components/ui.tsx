import Link from "next/link";

export function tierMeta(tier: string) {
  if (tier?.includes("TIER 1")) return { label: "HOT", cls: "bg-hot/15 text-hot border border-hot/30" };
  if (tier?.includes("TIER 2")) return { label: "WARM", cls: "bg-warm/15 text-warm border border-warm/30" };
  if (tier?.includes("TIER 3")) return { label: "NURTURE", cls: "bg-nurture/15 text-nurture border border-nurture/30" };
  return { label: "WATCH", cls: "bg-watch/15 text-watch border border-watch/30" };
}

export function TierChip({ tier }: { tier: string }) {
  const m = tierMeta(tier);
  return <span className={`chip ${m.cls}`}>{m.label}</span>;
}

export function StrengthChip({ s }: { s: string }) {
  const cls = s === "HIGH" ? "bg-hot/15 text-hot" : s === "MEDIUM" ? "bg-warm/15 text-warm" : "bg-watch/15 text-watch";
  return <span className={`chip ${cls}`}>{s}</span>;
}

export function Stat({ label, value, sub, accent }: { label: string; value: React.ReactNode; sub?: string; accent?: string }) {
  return (
    <div className="card p-4">
      <div className="label">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${accent ?? "text-white"}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const LAYER_STATE_CLS: Record<string, string> = {
  done: "border-ok/50 bg-ok/10 text-ok",
  running: "border-accent2/60 bg-accent2/10 text-accent2 animate-pulse",
  error: "border-hot/60 bg-hot/10 text-hot",
  pending: "border-line bg-ink/40 text-muted",
};

export const LAYER_DEFS = [
  { key: "signals", n: 1, label: "Signal Detection & Scoring", desc: "GitHub + Hacker News signals, ICP scoring → tiers" },
  { key: "enroll", n: 2, label: "Enrollment & Sequencing", desc: "Apollo search, email enrichment, sequence enrollment" },
  { key: "content", n: 3, label: "Content & Distribution", desc: "Persona-specific messages + engagement assets" },
  { key: "monitor", n: 4, label: "Attribution & Monitoring", desc: "Funnel metrics, engagement, Slack alerts" },
  { key: "replies", n: 5, label: "Response Handling", desc: "Instantly reply triage + Claude-drafted responses" },
] as const;

export function LayerPipeline({ state }: { state: Record<string, string> }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
      {LAYER_DEFS.map((l, i) => {
        const st = state?.[l.key] ?? "pending";
        return (
          <div key={l.key} className="relative">
            <div className={`card h-full p-4 ${LAYER_STATE_CLS[st]}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider opacity-70">LAYER {l.n}</span>
                <span className="text-[10px] uppercase tracking-wider">{st}</span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white">{l.label}</div>
              <div className="mt-1 text-xs leading-snug text-muted">{l.desc}</div>
            </div>
            {i < LAYER_DEFS.length - 1 && (
              <div className="absolute -right-2 top-1/2 z-10 hidden -translate-y-1/2 text-line md:block">→</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="font-semibold text-white">{value}</span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink/70">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "bg-ok/15 text-ok", running: "bg-accent2/15 text-accent2 animate-pulse",
    draft: "bg-watch/15 text-watch", paused: "bg-warm/15 text-warm", error: "bg-hot/15 text-hot",
  };
  return <span className={`chip ${map[status] ?? "bg-watch/15 text-watch"}`}>{status}</span>;
}

export function EmptyState({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string } }) {
  return (
    <div className="card flex flex-col items-center justify-center gap-3 p-12 text-center">
      <div className="text-lg font-semibold text-white">{title}</div>
      <div className="max-w-md text-sm text-muted">{body}</div>
      {cta && <Link href={cta.href} className="btn-primary mt-1">{cta.label}</Link>}
    </div>
  );
}
