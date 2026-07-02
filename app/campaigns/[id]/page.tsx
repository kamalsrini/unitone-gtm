"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { Stat, StatusBadge, TierChip, StrengthChip, FunnelBar, LAYER_DEFS } from "../../components/ui";

const LAYER_STATE_CLS: Record<string, string> = {
  done: "border-ok/50 bg-ok/10", running: "border-accent2/60 bg-accent2/10 animate-pulse",
  error: "border-hot/60 bg-hot/10", pending: "border-line bg-ink/40",
};


export default function CampaignMonitor({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<any>(null);
  const [tab, setTab] = useState("accounts");
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
    setData(d);
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Poll while any layer is running
  useEffect(() => {
    const ls = data?.campaign?.layer_state ?? {};
    const anyRunning = Object.values(ls).includes("running") || data?.campaign?.status === "running";
    if (!anyRunning) return;
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [data, load]);

  async function runLayer(layer?: string) {
    setRunning(layer ?? "all");
    await fetch(`/api/campaigns/${id}/run`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(layer ? { layer } : {}),
    });
    setRunning(null);
    load();
  }

  async function deleteCampaign() {
    if (!confirm(`Delete "${data?.campaign?.name}"? This permanently removes the campaign and its data from the dashboard (your Instantly campaign is not affected).`)) return;
    await fetch(`/api/delete-campaign?id=${id}&force=1`);
    window.location.href = "/";
  }

  if (!data) return <div className="card p-10 text-center text-muted">Loading campaign…</div>;
  if (data.error) return <div className="card p-10 text-center text-hot">{data.error}</div>;

  const { campaign: c, stats: s, accounts, signals, contacts, messages, replies, sequence = [] } = data;
  const linked = !!(c.config?.instantly_campaign_id);
  const ls = c.layer_state ?? {};
  const max = Math.max(s.accounts ?? 1, 1);
  const tabs = [
    ["accounts", `Accounts ${accounts.length}`], ["signals", `Signals ${signals.length}`],
    ["messages", `Messages ${messages.length}`], ["contacts", `Contacts ${contacts.length}`],
    ["replies", `Replies ${replies.length}`], ["sequence", `Sequence ${sequence.length}`],
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-xs text-muted hover:text-white">← Dashboard</Link>
          <div className="mt-1 flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
            <StatusBadge status={c.status} />
          </div>
          <p className="mt-1 text-sm capitalize text-muted">{String(c.persona).replace("_", " ")} · {c.channel} · {(c.config?.segments ?? []).join(", ") || "all segments"}</p>
        </div>
        <div className="flex items-center gap-2">
          {linked ? (
            data.dataStatus === "live" ? (
              <span className="chip bg-ok/15 text-ok">● Live from Instantly</span>
            ) : data.dataStatus === "cache" ? (
              <span className="chip bg-watch/15 text-watch">◐ Cached snapshot</span>
            ) : (
              <span className="chip bg-hot/15 text-hot">● Instantly unreachable</span>
            )
          ) : (
            <button onClick={() => runLayer()} disabled={running !== null} className="btn-primary">
              {running === "all" ? "Running pipeline…" : "▶ Run full pipeline"}
            </button>
          )}
          <button onClick={deleteCampaign} className="rounded-lg border border-hot/50 px-3 py-1.5 text-sm text-hot hover:bg-hot/10">Delete</button>
        </div>
      </div>

      {linked && data.dataStatus !== "live" && (
        <div className="rounded-lg border border-watch/40 bg-watch/10 px-4 py-3 text-sm text-watch">
          {data.dataStatus === "cache" ? (
            <>Showing the last synced snapshot{data.dataUpdatedAt ? ` from ${new Date(data.dataUpdatedAt).toLocaleString()}` : ""}. Live Instantly sync is currently failing — most likely the workspace plan is inactive (HTTP 402). Reactivate the Instantly plan to resume live metrics and sending.</>
          ) : (
            <>Can\'t reach Instantly right now — most likely the workspace plan is inactive (HTTP 402 Payment Required). No synced snapshot exists yet, so the funnel below reads 0. Reactivate the Instantly plan in Instantly to resume sync and sending. Accounts shown are this campaign\'s real targets.</>
          )}
        </div>
      )}

      {/* 5-layer pipeline with per-layer run buttons */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
        {LAYER_DEFS.map((l) => {
          const st = ls[l.key] ?? "pending";
          return (
            <Link key={l.key} href={`/campaigns/${id}/layers/${l.key}`} className={`card block p-4 transition hover:border-accent/60 ${LAYER_STATE_CLS[st]}`}>
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold tracking-wider text-muted">LAYER {l.n}</span>
                <span className="text-[10px] uppercase tracking-wider text-muted">{st}</span>
              </div>
              <div className="mt-1.5 text-sm font-semibold text-white">{l.label}</div>
              <div className="mt-1 text-xs leading-snug text-muted">{l.desc}</div>
              <div className="mt-3 text-xs font-medium text-accent">View & edit →</div>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <Stat label="Signals" value={s.signals} accent="text-accent2" />
        <Stat label="HOT" value={s.hot} accent="text-hot" />
        <Stat label="WARM" value={s.warm} accent="text-warm" />
        <Stat label="Enrolled" value={s.enrolled} />
        <Stat label="Sent" value={s.sent} accent="text-ok" />
        <Stat label="Meetings" value={s.meetings} accent="text-ok" />
      </div>

      <div className="card p-5">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Funnel</h2>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <FunnelBar label="Accounts scored" value={s.accounts} max={max} color="#5b8cff" />
          <FunnelBar label="Contacts found" value={s.contacts} max={max} color="#22d3ee" />
          <FunnelBar label="Enrolled" value={s.enrolled} max={max} color="#7c5bff" />
          <FunnelBar label="Sent" value={s.sent} max={max} color="#2dd4a7" />
          <FunnelBar label="Replies" value={s.replies} max={max} color="#ffb020" />
          <FunnelBar label="Meetings" value={s.meetings} max={max} color="#ff5470" />
        </div>
      </div>

      <div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`rounded-lg px-3 py-1.5 text-sm ${tab === k ? "bg-accent text-white" : "border border-line text-muted hover:text-white"}`}>{label}</button>
          ))}
        </div>

        {tab === "accounts" && <AccountsTable rows={accounts} />}
        {tab === "signals" && <SignalsTable rows={signals} />}
        {tab === "messages" && <MessagesList rows={messages} />}
        {tab === "contacts" && <ContactsTable rows={contacts} />}
        {tab === "replies" && <RepliesList rows={replies} onUpdate={load} />}
        {tab === "sequence" && <SequenceView steps={sequence} />}
      </div>
    </div>
  );
}

function SequenceView({ steps }: { steps: any[] }) {
  if (!steps?.length) return <Empty msg="No sequence steps found — is INSTANTLY_API_KEY set and the campaign linked?" />;
  return (
    <div className="space-y-3">
      {steps.map((st: any) => (
        <div key={st.step} className="card p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="chip bg-accent/15 text-accent">Step {st.step}</span>
            <span className="text-xs text-muted">wait {st.delay}d before next</span>
          </div>
          {st.variants.map((v: any, i: number) => (
            <div key={i} className={i > 0 ? "mt-3 border-t border-line pt-3" : "mt-1"}>
              {st.variants.length > 1 && <div className="text-[11px] uppercase tracking-wider text-muted">Variant {String.fromCharCode(65 + i)}</div>}
              <div className="mt-1 text-sm font-medium text-accent2">{v.subject || "(no subject)"}</div>
              <pre className="mt-1 whitespace-pre-wrap scrollbar-thin text-xs leading-relaxed text-muted">{v.body}</pre>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="card p-8 text-center text-sm text-muted">{msg}</div>;
}

function AccountsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty msg="No scored accounts yet — run Layer 1." />;
  return (
    <div className="card overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line">
            <th className="px-4 py-3">Account</th><th className="px-4 py-3">Tier</th>
            <th className="px-4 py-3 text-right">Score</th><th className="px-4 py-3 text-right">Firm</th>
            <th className="px-4 py-3 text-right">Tech</th><th className="px-4 py-3 text-right">Intent</th>
            <th className="px-4 py-3 text-right">Sigs</th><th className="px-4 py-3">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id} className="border-b border-line/50 hover:bg-ink/40">
              <td className="px-4 py-2.5"><div className="font-medium text-white">{a.name}</div><div className="text-xs text-muted">{a.domain}</div></td>
              <td className="px-4 py-2.5"><TierChip tier={a.tier} /></td>
              <td className="px-4 py-2.5 text-right font-semibold">{a.total_score}</td>
              <td className="px-4 py-2.5 text-right text-muted">{a.firmographic_score}</td>
              <td className="px-4 py-2.5 text-right text-muted">{a.technographic_score}</td>
              <td className="px-4 py-2.5 text-right text-muted">{a.intent_score}</td>
              <td className="px-4 py-2.5 text-right text-muted">{a.matched_signals}</td>
              <td className="px-4 py-2.5 text-xs text-muted">{a.action}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SignalsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty msg="No signals detected yet — run Layer 1." />;
  return (
    <div className="space-y-2">
      {rows.map((s) => (
        <div key={s.id} className="card flex items-center gap-3 p-3">
          <StrengthChip s={s.signal_strength} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium text-white">{s.company} <span className="text-xs text-muted">· {s.signal_type}</span></div>
            <div className="truncate text-xs text-muted">{s.detail}</div>
          </div>
          <span className="chip bg-ink/60 text-muted">{s.source}</span>
          {s.url && <a href={s.url} target="_blank" className="text-xs text-accent hover:underline">open ↗</a>}
        </div>
      ))}
    </div>
  );
}

function MessagesList({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty msg="No messages generated yet — run Layer 3." />;
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {rows.map((m) => (
        <div key={m.id} className="card p-4">
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">{m.company}</span>
            <span className="chip bg-accent/15 text-accent capitalize">{String(m.persona).replace("_", " ")}</span>
          </div>
          {m.contact_id && <div className="text-xs text-muted">to contact #{m.contact_id}</div>}
          <div className="mt-2 text-sm font-medium text-accent2">{m.subject}</div>
          <pre className="mt-2 max-h-40 overflow-y-auto whitespace-pre-wrap scrollbar-thin text-xs leading-relaxed text-muted">{m.body}</pre>
          <div className="mt-2 flex items-center gap-2 border-t border-line pt-2 text-xs text-muted">
            <span className="chip bg-ink/60">{m.asset_type}</span>
            <span className="truncate">{m.cta}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function ContactsTable({ rows }: { rows: any[] }) {
  if (!rows.length) return <Empty msg="No contacts yet — run Layer 2 (requires Apollo)." />;
  return (
    <div className="card overflow-x-auto scrollbar-thin">
      <table className="w-full text-sm">
        <thead className="text-left text-xs uppercase tracking-wider text-muted">
          <tr className="border-b border-line"><th className="px-4 py-3">Name</th><th className="px-4 py-3">Title</th><th className="px-4 py-3">Company</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Status</th></tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-line/50 hover:bg-ink/40">
              <td className="px-4 py-2.5 font-medium text-white">{c.name}</td>
              <td className="px-4 py-2.5 text-muted">{c.title}</td>
              <td className="px-4 py-2.5 text-muted">{c.company}</td>
              <td className="px-4 py-2.5 text-muted">{c.email ?? <span className="text-watch">—</span>}</td>
              <td className="px-4 py-2.5"><span className={`chip ${c.status === "enrolled" ? "bg-ok/15 text-ok" : "bg-watch/15 text-watch"}`}>{c.status}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RepliesList({ rows, onUpdate }: { rows: any[]; onUpdate: () => void }) {
  if (!rows.length) return <Empty msg="No replies yet — Layer 5 polls Instantly hourly." />;
  const emoji: Record<string, string> = { MEETING: "🟢", QUESTION: "🟡", NOT_INTERESTED: "⚪", OOO_DEFER: "🕗", AUTO: "⚙️" };
  async function mark(id: number) {
    await fetch(`/api/replies/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ handled: true }) });
    onUpdate();
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className={`card p-4 ${r.handled ? "opacity-60" : ""}`}>
          <div className="flex items-center justify-between">
            <span className="font-medium text-white">{emoji[r.intent] ?? "🟡"} {r.intent?.replace("_", " ")} · {r.from_email}</span>
            <span className="chip bg-ink/60 text-muted">{r.urgency}</span>
          </div>
          <div className="mt-1 text-sm text-muted">{r.summary}</div>
          {r.suggested_reply && <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-ink/60 p-3 text-xs text-accent2">{r.suggested_reply}</pre>}
          {!r.handled && <button onClick={() => mark(r.id)} className="mt-2 text-xs text-accent hover:underline">Mark handled</button>}
        </div>
      ))}
    </div>
  );
}
