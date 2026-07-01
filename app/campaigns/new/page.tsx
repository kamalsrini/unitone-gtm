"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface AiDraft {
  name: string;
  segments: string[];
  persona: string;
  channel: string;
  accounts: { name: string; domain: string; segment: string }[];
  layers: Record<string, any>;
  brief: string;
}

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

  // AI describe-it flow
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [drafting, setDrafting] = useState(false);
  const [aiError, setAiError] = useState("");
  const [aiSummary, setAiSummary] = useState("");
  const [draft, setDraft] = useState<AiDraft | null>(null);

  useEffect(() => {
    fetch("/api/sequences").then((r) => r.json()).then((d) => {
      setSequences(d.sequences ?? []);
      setApolloOn(!!d.configured);
    });
  }, []);

  function toggleSeg(k: string) {
    setSegments((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  }

  async function draftWithAI() {
    setAiError("");
    if (!description.trim() && !file) { setAiError("Describe the campaign or attach a document first."); return; }
    setDrafting(true);
    try {
      const fd = new FormData();
      fd.append("description", description);
      if (file) fd.append("file", file);
      const res = await fetch("/api/campaigns/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) { setAiError(data.error ?? "Couldn't draft the campaign."); return; }
      const d: AiDraft = data.draft;
      setDraft(d);
      setAiSummary(data.summary ?? "");
      if (d.name) setName(d.name);
      if (d.segments.length) setSegments(d.segments);
      if (d.persona) setPersona(d.persona);
      if (d.channel) setChannel(d.channel);
    } catch (e: any) {
      setAiError(String(e?.message ?? e));
    } finally {
      setDrafting(false);
    }
  }

  async function submit(launch: boolean) {
    setError("");
    if (!name.trim()) { setError("Give the campaign a name."); return; }
    setSubmitting(true);
    const res = await fetch("/api/campaigns", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name, segments, persona, channel, autoEnroll, sequenceId: sequenceId || null,
        accounts: draft?.accounts ?? [],
        layers: draft?.layers ?? {},
        brief: draft?.brief || undefined,
      }),
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
        <p className="mt-1 text-sm text-muted">Describe it in plain English (attach a doc if you have one) and let AI draft the setup — or fill in the form directly. Launching runs all five layers end-to-end.</p>
      </div>

      <div className="card space-y-3 border-accent/30 p-5">
        <label className="label">Describe the campaign <span className="text-muted/60">(AI drafts ICP, persona &amp; targeting)</span></label>
        <textarea
          className="input min-h-[110px] resize-y"
          placeholder={"e.g. Target OT/building-automation controls companies in the Niagara ecosystem ahead of the CRA deadline. Go after VP Eng and CTO with the security-fixes angle. Companies like JCI, Honeywell, Tridium…"}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" className="hidden" accept=".pdf,.docx,.md,.txt,.csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileRef.current?.click()} className="btn-ghost text-xs">
            {file ? "Change document" : "Attach document"}
          </button>
          {file && (
            <span className="flex items-center gap-2 rounded-lg border border-line px-2 py-1 text-xs text-muted">
              {file.name}
              <button type="button" className="text-muted hover:text-white" onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}>✕</button>
            </span>
          )}
          <span className="text-xs text-muted/60">PDF, Word, Markdown, or plain text</span>
          <button type="button" disabled={drafting} onClick={draftWithAI} className="btn-primary ml-auto">
            {drafting ? "Drafting…" : "Draft campaign with AI"}
          </button>
        </div>
        {aiError && <p className="rounded-lg bg-hot/10 px-3 py-2 text-xs text-hot">{aiError}</p>}
        {draft && (
          <div className="space-y-2 rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-xs text-accent">✓ {aiSummary || "Draft applied — review below, tweak anything, then create."}</p>
            {draft.brief && <p className="text-xs text-muted">{draft.brief}</p>}
            {draft.accounts.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {draft.accounts.map((a) => (
                  <span key={a.domain} className="rounded bg-line/50 px-2 py-0.5 text-[11px] text-muted">{a.name}</span>
                ))}
                <span className="px-1 text-[11px] text-muted/60">will be added as named target accounts</span>
              </div>
            )}
            {Object.keys(draft.layers).length > 0 && (
              <p className="text-[11px] text-muted/60">Pre-configured layers: {Object.keys(draft.layers).join(", ")} — editable per layer after creation.</p>
            )}
          </div>
        )}
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
