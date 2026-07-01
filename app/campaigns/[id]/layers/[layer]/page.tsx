"use client";
import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { TierChip, StrengthChip } from "../../../../components/ui";

const META: Record<string, { n: number; label: string; desc: string }> = {
  signals: { n: 1, label: "Signal Detection & Scoring", desc: "Signals detected and how accounts scored into tiers." },
  enroll: { n: 2, label: "Enrollment & Sequencing", desc: "Apollo people search + email enrichment and the enrolled leads." },
  content: { n: 3, label: "Content & Distribution", desc: "The live outbound sequence — edit each step and save back to Instantly." },
  monitor: { n: 4, label: "Attribution & Monitoring", desc: "Live funnel, engagement and alerting." },
  replies: { n: 5, label: "Response Handling", desc: "Inbound reply triage — polled 3×/day (9am/1pm/5pm ET), classified + drafted into Slack." },
};

export default function LayerScreen({ params }: { params: Promise<{ id: string; layer: string }> }) {
  const { id, layer } = use(params);
  const [data, setData] = useState<any>(null);
  const [steps, setSteps] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const meta = META[layer] ?? { n: 0, label: layer, desc: "" };

  const load = useCallback(async () => {
    const d = await fetch(`/api/campaigns/${id}`).then((r) => r.json());
    setData(d);
    if (layer === "content") {
      const seq = await fetch(`/api/campaigns/${id}/sequence`).then((r) => r.json());
      setSteps(seq.steps ?? []);
    }
  }, [id, layer]);
  useEffect(() => { load(); }, [load]);

  function editVariant(si: number, vi: number, field: string, val: string) {
    setSteps((prev) => prev.map((s, i) => (i !== si ? s : { ...s, variants: s.variants.map((v: any, j: number) => (j !== vi ? v : { ...v, [field]: val })) })));
  }
  async function saveSequence() {
    setSaving(true); setMsg("");
    const res = await fetch(`/api/campaigns/${id}/sequence`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ steps }) }).then((r) => r.json());
    setSaving(false); setMsg(res.ok ? "Saved to Instantly ✓" : "Save failed");
    if (res.ok) setTimeout(load, 400);
  }

  if (!data) return <div className="card p-10 text-center text-muted">Loading layer…</div>;
  if (data.error) return <div className="card p-10 text-center text-hot">{data.error}</div>;
  const c = data.campaign;
  const s = data.stats ?? {};

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/campaigns/${id}`} className="text-xs text-accent hover:underline">← Back to {c?.name ?? "campaign"}</Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Layer {meta.n} — {meta.label}</h1>
        <p className="mt-1 text-sm text-muted">{meta.desc}</p>
      </div>

      {layer === "content" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">Sequence · {steps.length} steps</h2>
            <div className="flex items-center gap-3">
              {msg && <span className={`text-xs ${msg.includes("✓") ? "text-ok" : "text-hot"}`}>{msg}</span>}
              <button onClick={saveSequence} disabled={saving || !steps.length} className="btn-primary">{saving ? "Saving…" : "Save to Instantly"}</button>
            </div>
          </div>
          {steps.map((st, si) => (
            <div key={si} className="card p-4">
              <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">Step {st.step} · sends {st.delay} day(s) after previous</div>
              {st.variants.map((v: any, vi: number) => (
                <div key={vi} className="mt-3 border-t border-line pt-3 first:mt-1 first:border-0 first:pt-0">
                  {st.variants.length > 1 && <div className="mb-1 text-[10px] uppercase tracking-wider text-muted">Variant {String.fromCharCode(65 + vi)}</div>}
                  <label className="text-[10px] uppercase tracking-wider text-muted">Subject</label>
                  <input value={v.subject} onChange={(e) => editVariant(si, vi, "subject", e.target.value)}
                    className="mb-2 mt-0.5 w-full rounded-md border border-line bg-ink/60 px-3 py-1.5 text-sm text-accent2" />
                  <label className="text-[10px] uppercase tracking-wider text-muted">Body</label>
                  <textarea value={v.body} onChange={(e) => editVariant(si, vi, "body", e.target.value)} spellCheck={false}
                    className="mt-0.5 h-44 w-full rounded-md border border-line bg-ink/60 p-3 font-mono text-xs leading-relaxed text-white" />
                </div>
              ))}
            </div>
          ))}
          <p className="text-xs text-muted">Tokens {"{{firstName}}"}, {"{{companyName}}"}, {"{{icebreaker}}"} are filled per lead at send time. Saving writes directly to the live Instantly campaign.</p>
        </div>
      )}

      {layer === "signals" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi l="Accounts" v={s.accounts} /><Kpi l="HOT" v={s.hot} accent="text-hot" />
            <Kpi l="WARM" v={s.warm} accent="text-warm" /><Kpi l="Signals" v={data.signals?.length ?? 0} accent="text-accent2" />
          </div>
          <Section title="Accounts & scoring">
            {(data.accounts ?? []).length === 0 ? <Empty msg="No scored accounts." /> :
              <table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr className="border-b border-line"><th className="px-3 py-2">Account</th><th className="px-3 py-2">Tier</th><th className="px-3 py-2 text-right">Score</th><th className="px-3 py-2 text-right">Firm</th><th className="px-3 py-2 text-right">Tech</th><th className="px-3 py-2 text-right">Intent</th></tr></thead>
                <tbody>{data.accounts.map((a: any) => (<tr key={a.id} className="border-b border-line/40"><td className="px-3 py-2 font-medium text-white">{a.name}</td><td className="px-3 py-2"><TierChip tier={a.tier} /></td><td className="px-3 py-2 text-right">{a.total_score ?? "—"}</td><td className="px-3 py-2 text-right text-muted">{a.firmographic_score ?? "—"}</td><td className="px-3 py-2 text-right text-muted">{a.technographic_score ?? "—"}</td><td className="px-3 py-2 text-right text-muted">{a.intent_score ?? "—"}</td></tr>))}</tbody></table>}
          </Section>
          <Section title="Signals that fed scoring">
            {(data.signals ?? []).length === 0 ? <Empty msg="No signals (named-account targeting — accounts were hand-selected, not signal-scored)." /> :
              <div className="space-y-2">{data.signals.map((sig: any) => (<div key={sig.id} className="flex items-center gap-3 rounded-lg border border-line p-2.5"><StrengthChip s={sig.signal_strength} /><div className="min-w-0 flex-1"><div className="text-sm text-white">{sig.company} <span className="text-xs text-muted">· {sig.signal_type}</span></div><div className="truncate text-xs text-muted">{sig.detail}</div></div>{sig.url && <a href={sig.url} target="_blank" className="text-xs text-accent hover:underline">open ↗</a>}</div>))}</div>}
          </Section>
          <ConfigEditor id={id} layer={layer} config={c?.config?.signals ?? {}} onSaved={load} hint="ICP scoring weights / segments for this campaign." />
        </div>
      )}

      {layer === "enroll" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Kpi l="Contacts" v={s.contacts} /><Kpi l="Enrolled" v={s.enrolled} accent="text-ok" /><Kpi l="Sent" v={s.sent} accent="text-ok" />
          </div>
          <Section title="Enriched leads (from Apollo → Instantly)">
            {(data.contacts ?? []).length === 0 ? <Empty msg="No leads." /> :
              <table className="w-full text-sm"><thead className="text-left text-xs uppercase tracking-wider text-muted"><tr className="border-b border-line"><th className="px-3 py-2">Name</th><th className="px-3 py-2">Company</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Status</th></tr></thead>
                <tbody>{data.contacts.map((ct: any) => (<tr key={ct.id} className="border-b border-line/40"><td className="px-3 py-2 font-medium text-white">{ct.name}</td><td className="px-3 py-2 text-muted">{ct.company}</td><td className="px-3 py-2 text-muted">{ct.email}</td><td className="px-3 py-2"><span className="chip bg-ok/15 text-ok">{ct.status}</span></td></tr>))}</tbody></table>}
          </Section>
          <ConfigEditor id={id} layer={layer} config={c?.config?.enroll ?? {}} onSaved={load} hint="Apollo search filters (titles, seniorities, employee ranges, domains) for this campaign." />
        </div>
      )}

      {layer === "monitor" && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3 md:grid-cols-6">
            <Kpi l="Sent" v={s.sent} accent="text-ok" /><Kpi l="Opens" v={s.opens} /><Kpi l="Clicks" v={s.clicks} /><Kpi l="Replies" v={s.replies} accent="text-warm" /><Kpi l="Meetings" v={s.meetings} accent="text-ok" /><Kpi l="Contacts" v={s.contacts} />
          </div>
          <p className="text-xs text-muted">Live from Instantly. Open-rate tracking is intentionally off (deliverability); reply rate is the tracked metric. A daily health digest posts to Slack at 8:30am ET.</p>
          <ConfigEditor id={id} layer={layer} config={c?.config?.monitor ?? {}} onSaved={load} hint="Alerting thresholds (e.g. spam-blocked kill-switch, bounce cap) for this campaign." />
        </div>
      )}

      {layer === "replies" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-line p-3 text-sm text-muted">Polled <span className="text-white">3×/day</span> (9am / 1pm / 5pm ET, weekdays). Each reply is classified (meeting / question / not-interested / OOO / auto), drafted, and posted to Slack for review. Nothing is auto-sent to prospects.</div>
          <Section title="Replies">
            {(data.replies ?? []).length === 0 ? <Empty msg="No replies yet." /> :
              <div className="space-y-2">{data.replies.map((rp: any) => (<div key={rp.id} className="rounded-lg border border-line p-3"><div className="flex items-center justify-between"><span className="text-sm text-white">{rp.from_email}</span><span className="chip bg-accent/15 text-accent">{rp.intent}</span></div><div className="mt-1 text-xs text-muted">{rp.summary}</div></div>))}</div>}
          </Section>
          <ConfigEditor id={id} layer={layer} config={c?.config?.replies ?? {}} onSaved={load} hint="Reply-triage settings (Calendly link, tone, auto-classify rules) for this campaign." />
        </div>
      )}
    </div>
  );
}

function Kpi({ l, v, accent }: { l: string; v: any; accent?: string }) {
  return <div className="card p-3"><div className="text-[11px] uppercase tracking-wider text-muted">{l}</div><div className={`mt-0.5 text-2xl font-semibold ${accent ?? "text-white"}`}>{v ?? 0}</div></div>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="card p-4"><h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3><div className="overflow-x-auto scrollbar-thin">{children}</div></div>;
}
function Empty({ msg }: { msg: string }) { return <div className="py-4 text-center text-sm text-muted">{msg}</div>; }

function ConfigEditor({ id, layer, config, onSaved, hint }: { id: string; layer: string; config: any; onSaved: () => void; hint?: string }) {
  const [text, setText] = useState(JSON.stringify(config ?? {}, null, 2));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { setText(JSON.stringify(config ?? {}, null, 2)); }, [config]);
  async function save() {
    let parsed: any;
    try { parsed = JSON.parse(text || "{}"); } catch { setMsg("Invalid JSON"); return; }
    setSaving(true); setMsg("");
    await fetch(`/api/campaigns/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ layer, config: parsed }) });
    setSaving(false); setMsg("Saved ✓"); onSaved();
  }
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">Edit this layer</h3>
        <div className="flex items-center gap-3">{msg && <span className="text-xs text-ok">{msg}</span>}<button onClick={save} disabled={saving} className="btn-primary">{saving ? "Saving…" : "Save config"}</button></div>
      </div>
      {hint && <p className="mb-2 text-xs text-muted">{hint}</p>}
      <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} className="h-40 w-full rounded-lg border border-line bg-ink/60 p-3 font-mono text-xs text-white" />
    </div>
  );
}
