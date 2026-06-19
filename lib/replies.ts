/**
 * UnitOne GTM Engine — Layer 5 Reply Triage (ported from reply_loop.py)
 * Polls Instantly for inbound replies, classifies intent + drafts a reply via Claude.
 * Never auto-sends to prospects — human approves from the dashboard / Unibox.
 */
const IBASE = "https://api.instantly.ai/api/v2";
const CALENDLY = "https://calendly.com/kamal-srinivasan-unitone/30min";

export interface TriagedReply {
  external_id: string;
  from_email: string;
  subject: string;
  body: string;
  intent: "MEETING" | "QUESTION" | "NOT_INTERESTED" | "OOO_DEFER" | "AUTO";
  urgency: "high" | "med" | "low";
  summary: string;
  suggested_reply: string;
}

function ihdr() {
  return {
    Authorization: `Bearer ${process.env.INSTANTLY_API_KEY || ""}`,
    "User-Agent": "unitone-gtm/1.0",
    Accept: "application/json",
  };
}

export function instantlyConfigured(): boolean {
  return !!process.env.INSTANTLY_API_KEY;
}

async function iget(path: string): Promise<any> {
  const res = await fetch(IBASE + path, { headers: ihdr(), cache: "no-store" });
  if (!res.ok) throw new Error(`Instantly ${res.status}`);
  return res.json();
}

function strip(t: string): string {
  if (!t) return "";
  return t.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, "").trim();
}

async function ourMailboxes(): Promise<Set<string>> {
  try {
    const data = await iget("/accounts?limit=100");
    return new Set((data.items ?? []).map((a: any) => (a.email ?? "").toLowerCase()));
  } catch {
    return new Set();
  }
}

const CLASSIFY_SYS = `You triage a cold-outbound REPLY for a founder selling UnitOne (deterministic
security remediation for industrial/controls software: verified patches that land in minutes,
run in the customer's environment). Read the prospect's reply and return STRICT JSON:
{"intent":"MEETING|QUESTION|NOT_INTERESTED|OOO_DEFER|AUTO","urgency":"high|med|low",
 "summary":"<one line: what they said + what they want>",
 "suggested_reply":"<a short, warm, specific reply Kamal can send; book via the Calendly link
   when appropriate; empty string if intent is AUTO>"}
Intents: MEETING=wants to talk/positive; QUESTION=interested w/ question or objection;
NOT_INTERESTED=clear no; OOO_DEFER=out of office or 'later'; AUTO=auto-reply/bounce/unsubscribe.
Keep suggested_reply under 90 words, no fluff, sign as 'Kamal'. Calendly: ${CALENDLY}`;

async function triage(replyText: string, from: string, subject: string): Promise<Omit<TriagedReply, "external_id" | "from_email" | "subject" | "body">> {
  const key = process.env.ANTHROPIC_API_KEY;
  const fallback = { intent: "QUESTION" as const, urgency: "med" as const, summary: strip(replyText).slice(0, 120), suggested_reply: "" };
  if (!key) return fallback;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-6", max_tokens: 500, temperature: 0.3, system: CLASSIFY_SYS,
        messages: [{ role: "user", content: `From: ${from}\nSubject: ${subject}\n\nReply:\n${replyText.slice(0, 2000)}` }],
      }),
    });
    const data = await res.json();
    const txt = (data.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
    const s = txt.indexOf("{"), e = txt.lastIndexOf("}");
    return { ...fallback, ...JSON.parse(txt.slice(s, e + 1)) };
  } catch {
    return fallback;
  }
}

/** Poll Instantly for replies not already seen (seen = set of external ids). */
export async function pollReplies(seen: Set<string>): Promise<TriagedReply[]> {
  if (!instantlyConfigured()) return [];
  const mailboxes = await ourMailboxes();
  let items: any[] = [];
  try {
    items = (await iget("/emails?limit=100")).items ?? [];
  } catch {
    return [];
  }
  const out: TriagedReply[] = [];
  for (const e of items) {
    const eid = e.id;
    if (!eid || seen.has(eid)) continue;
    const from = (e.from_address_email || e.from_address || "").toLowerCase();
    const inbound = e.ue_type === 2 || e.ue_type === "2" || (from && !mailboxes.has(from));
    if (!inbound) continue;
    const subject = e.subject || "";
    let body = strip((typeof e.body === "object" ? e.body?.text : e.body_text) || e.content_preview || "");
    if (!body) body = subject;
    const t = await triage(body, from, subject);
    if (t.intent === "AUTO") { out.push({ external_id: eid, from_email: from, subject, body, ...t }); continue; }
    out.push({ external_id: eid, from_email: from, subject, body, ...t });
  }
  return out;
}

export const INTENT_EMOJI: Record<string, string> = {
  MEETING: "🟢", QUESTION: "🟡", NOT_INTERESTED: "⚪", OOO_DEFER: "🕗", AUTO: "⚙️",
};
