"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const SEGMENTS = [
  { k: "modern_tech", l: "Modern Tech", d: "Cloud-native SaaS (Rippling, Datadog, Figma…)" },
  { k: "hybrid_tech", l: "Hybrid Tech", d: "Hardware + software (JCI, Honeywell, Siemens…)" },
  { k: "one_of_a_kind", l: "Hyperscalers", d: "Google, Microsoft, Amazon, OpenAI…" },
  { k: "traditional_tech", l: "Traditional", d: "Established enterprise software" },
];
const PERSONAS = [
  { k: "vp_engineering", l: "VP Engineering", d: "Remediation velocity & alert fatigue" },
  { k: "cto", l: "CTO", d: "Security model for agentic code" },
  { k: "cfo", l: "CFO", d: "Remediation cost / compliance ROI" },
  { k: "ceo", l: "CEO", d: "Security as competitive advantage" },
];

export default function NewCampaign() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [segments, setSegments] = useState<string[]>(["modern_tech"]);
  const [persona, setPersona] = useState("vp_engineering");
  const [channel, setChannel] = useState("email");
  const [autoEnroll, setAutoEnroll] = useState(false);
  const [sequenceId, setSequenceId] = useState("");
  const [sequences, setSequences] = useState<{ id: string; name: string }[]>([]);
  const [apolloOn, setApolloOn] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/sequences").then((r) => r.json()).then((d) => {
      setSequences(d.sequences ?? []);
      setApolloOn(!!d.configured);
    });
  }, []);

  function toggleSeg(k: string) {
    setSegments((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  }

  async function submit(launch: boolean) {
    setError("");
    if (!name.trim()) { setError("Give the campaign a name."); return; }
    setSubmitting(true);
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, segments, persona, channel, autoEnroll, sequenceId: sequenceId || null }),
    });
    const data = await res.json();
    if (!res.ok || data.error) { setError(data.error ?? "Failed to create campaign"); setSubmitting(false); return; }
    const id = data.campaign.id;
    if (launch) {
      fetch(`/api/campaigns/${id}/run`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
    }
    router.push(`/campaigns/${id}`);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">New Campaign</h1>
        <p className="mt-1 text-sm text-muted">Define the ICP and persona. Launching runs all five layers end-to-end.</p>
      </div>

      <div className="card space-y-2 p-5">
        <label className="label">Campaign name</label>
        <input className="input" placeholder="e.g. Modern Tech VP Eng — Q3" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="card space-y-3 p-5">
        <label className="label">ICP segments <span className="text-muted/60">(Layer 1 targeting)</span></label>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {SEGMENTS.map((s) => (
            <button key={s.k} onClick={() => toggleSeg(s.k)} type="button"
              className={`rounded-lg border p-3 text-left transition-colors ${segments.includes(s.k) ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"}`}>
              <div className="text-sm font-medium text-white">{s.l}</div>
              <div className="text-xs text-muted">{s.d}</div>
            </button>
          ))}
        </div>
        {segments.length === 0 && <p className="text-xs text-warm">Select at least one segment (or none = all named accounts).</p>}
      </div>

      <div className="card space-y-3 p-5">
        <label className="label">Primary persona <span className="text-muted/60">(Layer 3 messaging)</span></label>
        <div className="grid grid-cols-2 gap-2">
          {PERSONAS.map((p) => (
            <button key={p.k} onClick={() => setPersona(p.k)} type="button"
              className={`rounded-lg border p-3 text-left transition-colors ${persona === p.k ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"}`}>
              <div className="text-sm font-medium text-white">{p.l}</div>
              <div className="text-xs text-muted">{p.d}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <label className="label">Channel</label>
          <div className="ml-auto flex gap-1 rounded-lg border border-line p-1">
            {["email", "linkedin", "multi"].map((ch) => (
              <button key={ch} type="button" onClick={() => setChannel(ch)}
                className={`rounded px-3 py-1 text-xs capitalize ${channel === ch ? "bg-accent text-white" : "text-muted"}`}>{ch}</button>
            ))}
          </div>
        </div>

        <div className="border-t border-line pt-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium text-white">Auto-enroll into Apollo sequence</div>
              <div className="text-xs text-muted">Layer 2 will add enriched contacts to a live sequence (sends real email).</div>
            </div>
            <button type="button" onClick={() => setAutoEnroll((v) => !v)}
              className={`h-6 w-11 rounded-full transition-colors ${autoEnroll ? "bg-accent" : "bg-line"}`}>
              <span className={`block h-5 w-5 rounded-full bg-white transition-transform ${autoEnroll ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </div>
          {autoEnroll && (
            <div className="mt-3 space-y-2">
              {!apolloOn && <p className="text-xs text-warm">Apollo not connected — set APOLLO_API_KEY to enable live enrollment.</p>}
              {sequences.length > 0 ? (
                <select className="input" value={sequenceId} onChange={(e) => setSequenceId(e.target.value)}>
                  <option value="">Select Apollo sequence…</option>
                  {sequences.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <input className="input" placeholder="Apollo sequence ID" value={sequenceId} onChange={(e) => setSequenceId(e.target.value)} />
              )}
              <p className="rounded-lg bg-hot/10 px-3 py-2 text-xs text-hot">⚠ Live send. Leave off to stage contacts for manual review (recommended given current outbound freeze).</p>
            </div>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg bg-hot/10 px-4 py-3 text-sm text-hot">{error}</div>}

      <div className="flex items-center gap-3">
        <button disabled={submitting} onClick={() => submit(true)} className="btn-primary">
          {submitting ? "Working…" : "Create & Launch pipeline"}
        </button>
        <button disabled={submitting} onClick={() => submit(false)} className="btn-ghost">Save as draft</button>
      </div>
    </div>
  );
}
