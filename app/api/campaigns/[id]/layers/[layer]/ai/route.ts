import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCampaign } from "@/lib/db";
import { instantlyCampaignSequence, updateInstantlyCampaignSequence } from "@/lib/instantly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const LAYER_CTX: Record<string, string> = {
  signals: "ICP scoring for this campaign: which company attributes/signals raise or lower an account's tier (HOT/WARM). Use clear self-describing keys (weights, target_industries, must_have_signals, etc).",
  enroll: "Apollo people-search filters used to find + enrich leads: job titles, seniorities, employee-count ranges, target company domains, email verification.",
  monitor: "Monitoring & alerting thresholds: spam_blocked_kill_pct, bounce_cap_pct, daily_send_limit, alert channels, etc.",
  replies: "Reply-triage behavior: calendly_url, tone, how aggressively to book meetings vs answer questions, auto-draft rules.",
};

async function claude(system: string, user: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": process.env.ANTHROPIC_API_KEY || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 3500, temperature: 0.3, system, messages: [{ role: "user", content: user }] }),
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

export async function POST(req: Request, { params }: { params: Promise<{ id: string; layer: string }> }) {
  const { id, layer } = await params;
  const cid = Number(id);
  const { feedback } = await req.json().catch(() => ({}));
  if (!feedback) return NextResponse.json({ ok: false, error: "feedback required" }, { status: 400 });
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI is not configured (ANTHROPIC_API_KEY missing)." }, { status: 400 });
  const camp = await getCampaign(cid);
  const iid = (camp?.config as any)?.instantly_campaign_id as string | undefined;

  if (layer === "content") {
    if (!iid) return NextResponse.json({ ok: false, error: "This campaign isn't linked to Instantly." }, { status: 400 });
    const steps = await instantlyCampaignSequence(iid);
    const sys = `You edit a cold-email outbound sequence for UnitOne (deterministic security remediation for industrial-controls companies). Apply the user's plain-English feedback to the sequence.
RULES: keep the same number of steps and the same delays; preserve each step's A/B variant structure; keep the tokens {{firstName}}, {{companyName}}, {{icebreaker}} intact; step 1 must stay link-free; keep it deliverability-safe (no spammy/hyped subjects, no fake "RE:"). Do not invent metrics.
Return STRICT JSON only: {"steps":[{"step":<n>,"delay":<n>,"variants":[{"subject":"...","body":"..."}]}],"summary":"<one line describing what you changed>"}`;
    const out = parseJson(await claude(sys, `Current sequence (JSON):\n${JSON.stringify(steps)}\n\nUser feedback: ${feedback}`));
    if (!out?.steps?.length) return NextResponse.json({ ok: false, error: "The AI couldn't produce a valid edit — try rephrasing." }, { status: 502 });
    const ok = await updateInstantlyCampaignSequence(iid, out.steps);
    return NextResponse.json({ ok, summary: out.summary || "Sequence updated and saved to Instantly." });
  }

  const current = (camp?.config as any)?.[layer] ?? {};
  const sys = `You translate a user's plain-English feedback into a JSON config for the "${layer}" layer of a GTM campaign.
Layer context: ${LAYER_CTX[layer] || layer}. Merge the feedback into the current config sensibly, using clear self-describing keys. Keep existing keys unless the feedback changes them.
Return STRICT JSON only: {"config":{...},"summary":"<one line describing what you changed>"}`;
  const out = parseJson(await claude(sys, `Current config (JSON): ${JSON.stringify(current)}\n\nUser feedback: ${feedback}`));
  if (!out?.config) return NextResponse.json({ ok: false, error: "The AI couldn't produce a valid config — try rephrasing." }, { status: 502 });
  const key = "{" + layer + "}";
  await sql`UPDATE campaigns SET config = jsonb_set(coalesce(config, '{}'::jsonb), ${key}, ${JSON.stringify(out.config)}::jsonb), updated_at = now() WHERE id = ${cid}`;
  return NextResponse.json({ ok: true, summary: out.summary || "Config updated.", config: out.config });
}
