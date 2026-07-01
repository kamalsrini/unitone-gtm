import { NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const SEGMENT_KEYS = ["modern_tech", "hybrid_tech", "one_of_a_kind", "traditional_tech"] as const;
const PERSONA_KEYS = ["vp_engineering", "cto", "cfo", "ceo"] as const;
const CHANNELS = ["email", "linkedin", "multi"] as const;
const MAX_DOC_CHARS = 28000;

async function extractText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  const buf = Buffer.from(await file.arrayBuffer());
  if (name.endsWith(".pdf")) {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    return String(text);
  }
  if (name.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ buffer: buf });
    return r.value;
  }
  // txt, md, csv, json — treat as UTF-8 text
  return buf.toString("utf-8");
}

async function claude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY || "",
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }],
    }),
    cache: "no-store",
  });
  const j = await res.json();
  return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
}

function parseJson(t: string): any {
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch { return null; }
}

const SYSTEM = `You turn a founder's plain-English campaign description (and optionally an attached planning document) into a structured draft for UnitOne's 5-layer GTM engine.

UnitOne sells deterministic security remediation (auto-generated, verified vulnerability fixes; MTTR from ~84 days to minutes) to engineering leaders at software companies.

Pick from these fixed vocabularies:
- segments (ICP account buckets): "modern_tech" (cloud-native SaaS), "hybrid_tech" (hardware+software industrials like JCI/Honeywell/Siemens, incl. OT/BAS controls), "one_of_a_kind" (hyperscalers), "traditional_tech" (established enterprise software).
- persona (primary buyer): "vp_engineering" (remediation velocity, alert fatigue), "cto" (security model for agentic/AI code), "cfo" (remediation cost, compliance ROI), "ceo" (security as competitive advantage).
- channel: "email", "linkedin", or "multi".

Also extract, when the text supports it:
- accounts: explicit target companies named in the input → [{"name":"...","domain":"best-guess.com","segment":"<one of the segments>"}]. Only companies actually mentioned; guess the primary domain.
- layers.signals: ICP scoring emphasis — clear self-describing keys (e.g. target_industries, must_have_signals, weights, compliance_deadlines).
- layers.enroll: Apollo people-search filters — job titles, seniorities, employee-count ranges, geographies, target domains.
- layers.replies: reply-triage behavior — tone, meeting-booking aggressiveness, calendly_url if given.
Omit any layer the input says nothing about.

Return STRICT JSON only, no prose:
{"campaign":{"name":"<short, specific campaign name>","segments":["..."],"persona":"...","channel":"...","accounts":[...],"layers":{...},"brief":"<3-5 sentence internal brief: who we target, why now, the core message angle, and success criteria — grounded ONLY in the input>"},"summary":"<one line: what you set up and from what evidence>"}

Do not invent companies, metrics, or deadlines that are not in the input. If the input is thin, keep the draft minimal rather than padding it.`;

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ ok: false, error: "AI is not configured (ANTHROPIC_API_KEY missing)." }, { status: 400 });
  }

  let description = "";
  let docText = "";
  let docName = "";
  const ctype = req.headers.get("content-type") || "";
  try {
    if (ctype.includes("multipart/form-data")) {
      const form = await req.formData();
      description = String(form.get("description") || "");
      const file = form.get("file");
      if (file && file instanceof File && file.size > 0) {
        docName = file.name;
        docText = await extractText(file);
      }
    } else {
      const body = await req.json().catch(() => ({}));
      description = String(body?.description || "");
      docText = String(body?.docText || "");
    }
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: `Couldn't read the ${docName || "document"}: ${String(e?.message ?? e)}` }, { status: 400 });
  }

  description = description.trim();
  docText = docText.replace(/\u0000/g, "").trim();
  if (!description && !docText) {
    return NextResponse.json({ ok: false, error: "Describe the campaign or attach a document." }, { status: 400 });
  }
  if (docText.length > MAX_DOC_CHARS) docText = docText.slice(0, MAX_DOC_CHARS) + "\n…[truncated]";

  const user = [
    description ? `Campaign description:\n${description}` : "",
    docText ? `Attached document${docName ? ` (${docName})` : ""}:\n${docText}` : "",
  ].filter(Boolean).join("\n\n---\n\n");

  const out = parseJson(await claude(SYSTEM, user));
  const c = out?.campaign;
  if (!c?.name) {
    return NextResponse.json({ ok: false, error: "The AI couldn't produce a valid campaign draft — try adding more detail." }, { status: 502 });
  }

  // Validate against fixed vocabularies; drop anything off-menu.
  const segments = Array.isArray(c.segments) ? c.segments.filter((s: string) => (SEGMENT_KEYS as readonly string[]).includes(s)) : [];
  const persona = (PERSONA_KEYS as readonly string[]).includes(c.persona) ? c.persona : "vp_engineering";
  const channel = (CHANNELS as readonly string[]).includes(c.channel) ? c.channel : "email";
  const accounts = (Array.isArray(c.accounts) ? c.accounts : [])
    .filter((a: any) => a?.name && a?.domain)
    .map((a: any) => ({
      name: String(a.name),
      domain: String(a.domain).toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
      segment: (SEGMENT_KEYS as readonly string[]).includes(a.segment) ? a.segment : (segments[0] ?? "modern_tech"),
    }));
  const layers: Record<string, any> = {};
  for (const k of ["signals", "enroll", "replies"]) {
    if (c.layers?.[k] && typeof c.layers[k] === "object") layers[k] = c.layers[k];
  }

  return NextResponse.json({
    ok: true,
    draft: {
      name: String(c.name).slice(0, 120),
      segments,
      persona,
      channel,
      accounts,
      layers,
      brief: typeof c.brief === "string" ? c.brief : "",
    },
    summary: out.summary || "Campaign draft generated.",
    docChars: docText.length,
  });
}
