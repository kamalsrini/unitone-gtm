/**
 * UnitOne GTM — Pipeline orchestrator.
 * Runs each of the 5 layers for a campaign and persists results to Postgres.
 */
import { sql } from "@vercel/postgres";
import { NAMED_ACCOUNTS, NamedAccount, Segment, PersonaKey } from "./config";
import { runAllSignals } from "./signals";
import { scoreAllAccounts, AccountInput } from "./scorer";
import { generateMessage } from "./messenger";
import { apolloConfigured, searchPeople, enrichContact, addToSequence } from "./apollo";
import { pollReplies, instantlyConfigured } from "./replies";
import { slackNotify, campaignSummaryBlocks } from "./slack";
import {
  Campaign, LayerKey, getCampaign, setLayerState, setStatus, getStats,
} from "./db";

// Rough employee-count seed per segment so firmographic scoring has a baseline
// before Apollo enrichment fills exact counts (mirrors the Python defaults).
const SEGMENT_SIZE: Record<Segment, number> = {
  modern_tech: 1500, hybrid_tech: 3000, one_of_a_kind: 5000, traditional_tech: 800,
};
const SEGMENT_FUNDING: Record<Segment, string> = {
  modern_tech: "series c", hybrid_tech: "public", one_of_a_kind: "public", traditional_tech: "series b",
};

function selectAccounts(config: any): NamedAccount[] {
  const segments: string[] = config?.segments ?? [];
  const custom: NamedAccount[] = config?.accounts ?? [];
  let base = NAMED_ACCOUNTS;
  if (segments.length) base = base.filter((a) => segments.includes(a.segment));
  return [...base, ...custom];
}

function toInput(a: NamedAccount): AccountInput {
  return {
    ...a,
    employee_count: SEGMENT_SIZE[a.segment],
    annual_revenue: 120_000_000,
    funding_stage: SEGMENT_FUNDING[a.segment],
    technologies: ["github actions", "kubernetes", "docker", "snyk", "cursor"],
  };
}

async function clearLayer(campaignId: number, table: string) {
  await sql.query(`DELETE FROM ${table} WHERE campaign_id = $1`, [campaignId]);
}

/** LAYER 1 — Signal detection + ICP scoring. */
async function runSignals(c: Campaign) {
  const accounts = selectAccounts(c.config);
  const signals = await runAllSignals(accounts, 14);
  const scored = scoreAllAccounts(accounts.map(toInput), signals);

  await clearLayer(c.id, "signals");
  await clearLayer(c.id, "accounts");
  for (const s of signals) {
    await sql`INSERT INTO signals (campaign_id, company, domain, signal_type, signal_strength, detail, url, source)
      VALUES (${c.id}, ${s.company}, ${s.domain}, ${s.signal_type}, ${s.signal_strength}, ${s.detail ?? ""}, ${s.url ?? ""}, ${s.source ?? ""})`;
  }
  for (const a of scored) {
    await sql`INSERT INTO accounts (campaign_id, name, domain, segment, total_score, tier, action,
        firmographic_score, technographic_score, intent_score, breakdown, matched_signals)
      VALUES (${c.id}, ${a.name}, ${a.domain}, ${a.segment}, ${a.total_score}, ${a.tier}, ${a.action},
        ${a.firmographic_score}, ${a.technographic_score}, ${a.intent_score}, ${JSON.stringify(a.breakdown)}, ${a.matched_signals})`;
  }
  return { signals: signals.length, scored: scored.length, hot: scored.filter((s) => s.tier.includes("TIER 1")).length };
}

/** LAYER 2 — Enrollment: find decision-makers (Apollo), enrich emails, optionally enroll in sequence. */
async function runEnroll(c: Campaign) {
  const { rows: hotRows } = await sql`SELECT name, domain, segment, tier FROM accounts
    WHERE campaign_id=${c.id} AND (tier LIKE 'TIER 1%' OR tier LIKE 'TIER 2%') ORDER BY total_score DESC LIMIT 12`;
  await clearLayer(c.id, "contacts");

  let found = 0, enrolled = 0;
  if (!apolloConfigured()) {
    return { found: 0, enrolled: 0, note: "APOLLO_API_KEY not set — skipped live search" };
  }
  const domains = hotRows.map((r: any) => r.domain).filter(Boolean);
  if (!domains.length) return { found: 0, enrolled: 0 };

  let people: Awaited<ReturnType<typeof searchPeople>> = [];
  try {
    people = await searchPeople({ domains, perPage: 25 });
  } catch (e: any) {
    return { found: 0, enrolled: 0, error: String(e?.message ?? e) };
  }

  const enrolledIds: string[] = [];
  for (const p of people.slice(0, 25)) {
    let email = p.email;
    if (!email) {
      try { email = (await enrichContact({ apollo_id: p.apollo_id, name: p.name, domain: p.domain })).email; } catch { /* skip */ }
    }
    const persona = c.persona;
    const status = c.auto_enroll && c.sequence_id && email ? "enrolled" : "found";
    await sql`INSERT INTO contacts (campaign_id, apollo_id, name, title, persona, company, domain, email, linkedin_url, status)
      VALUES (${c.id}, ${p.apollo_id}, ${p.name}, ${p.title}, ${persona}, ${p.company}, ${p.domain}, ${email ?? null}, ${p.linkedin_url ?? ""}, ${status})`;
    found++;
    if (status === "enrolled") { enrolled++; enrolledIds.push(p.apollo_id); }
  }

  if (c.auto_enroll && c.sequence_id && enrolledIds.length) {
    try {
      await addToSequence({ sequenceId: c.sequence_id, contactIds: enrolledIds });
      for (let i = 0; i < enrolledIds.length; i++) {
        await sql`INSERT INTO events (campaign_id, type, detail) VALUES (${c.id}, 'sent', 'Enrolled in Apollo sequence')`;
      }
    } catch (e: any) {
      return { found, enrolled, error: `Enrollment add failed: ${String(e?.message ?? e)}` };
    }
  }
  return { found, enrolled };
}

/** LAYER 3 — Content: generate persona-specific messages for found contacts (or per-account defaults). */
async function runContent(c: Campaign) {
  const { rows: accts } = await sql`SELECT * FROM accounts WHERE campaign_id=${c.id}
    AND (tier LIKE 'TIER 1%' OR tier LIKE 'TIER 2%') ORDER BY total_score DESC LIMIT 12`;
  const { rows: sigs } = await sql`SELECT company, domain, signal_type, signal_strength FROM signals WHERE campaign_id=${c.id}`;
  const { rows: contacts } = await sql`SELECT * FROM contacts WHERE campaign_id=${c.id}`;
  await clearLayer(c.id, "messages");

  const signalRows = sigs.map((s: any) => ({ company: s.company, domain: s.domain, signal_type: s.signal_type, signal_strength: s.signal_strength }));
  let made = 0;
  for (const a of accts) {
    const scored = { name: a.name, domain: a.domain, segment: a.segment, tier: a.tier } as any;
    const acctContacts = contacts.filter((ct: any) => ct.domain && a.domain && ct.domain.includes(a.domain.split(".")[0]));
    const targets = acctContacts.length ? acctContacts : [null];
    for (const ct of targets) {
      const persona = (ct?.persona as PersonaKey) || (c.persona as PersonaKey) || "vp_engineering";
      const m = generateMessage(scored, signalRows, persona, ct ? { name: ct.name, title: ct.title } : undefined);
      await sql`INSERT INTO messages (campaign_id, contact_id, company, persona, subject, body, linkedin, asset_type, asset_url, cta)
        VALUES (${c.id}, ${ct?.id ?? null}, ${m.company}, ${m.persona}, ${m.subject}, ${m.body}, ${m.linkedin}, ${m.asset_type}, ${m.asset_url}, ${m.cta})`;
      made++;
    }
  }
  return { messages: made };
}

/** LAYER 4 — Attribution + monitoring + Slack alert. */
async function runMonitor(c: Campaign) {
  const stats = await getStats(c.id);
  await slackNotify(
    `UnitOne GTM — "${c.name}" snapshot`,
    campaignSummaryBlocks(c.name, {
      signals: stats.signals, scored: stats.accounts, hot: stats.hot,
      messages: stats.messages, enrolled: stats.enrolled, replies: stats.replies,
    })
  );
  return stats;
}

/** LAYER 5 — Reply handling (Instantly + Claude triage). */
async function runReplies(c: Campaign) {
  if (!instantlyConfigured()) return { replies: 0, note: "INSTANTLY_API_KEY not set" };
  const { rows: seenRows } = await sql`SELECT external_id FROM replies`;
  const seen = new Set(seenRows.map((r: any) => r.external_id));
  const triaged = await pollReplies(seen);
  let added = 0, meetings = 0;
  for (const t of triaged) {
    await sql`INSERT INTO replies (campaign_id, external_id, from_email, subject, body, intent, urgency, summary, suggested_reply)
      VALUES (${c.id}, ${t.external_id}, ${t.from_email}, ${t.subject}, ${t.body}, ${t.intent}, ${t.urgency}, ${t.summary}, ${t.suggested_reply})
      ON CONFLICT (external_id) DO NOTHING`;
    added++;
    if (t.intent === "MEETING") { meetings++; await sql`INSERT INTO events (campaign_id, type, detail) VALUES (${c.id}, 'reply', ${t.summary})`; }
  }
  return { replies: added, meetings };
}

const RUNNERS: Record<LayerKey, (c: Campaign) => Promise<any>> = {
  signals: runSignals, enroll: runEnroll, content: runContent, monitor: runMonitor, replies: runReplies,
};

export async function runLayer(campaignId: number, layer: LayerKey) {
  const c = await getCampaign(campaignId);
  if (!c) throw new Error("Campaign not found");
  await setLayerState(campaignId, layer, "running");
  await setStatus(campaignId, "running");
  try {
    const result = await RUNNERS[layer](c);
    await setLayerState(campaignId, layer, "done");
    return result;
  } catch (e: any) {
    await setLayerState(campaignId, layer, "error");
    await setStatus(campaignId, "error");
    throw e;
  }
}

/** Run all 5 layers in sequence (used by "Launch" and the daily cron). */
export async function runFullPipeline(campaignId: number) {
  const order: LayerKey[] = ["signals", "enroll", "content", "monitor", "replies"];
  const results: Record<string, any> = {};
  for (const layer of order) {
    try {
      results[layer] = await runLayer(campaignId, layer);
    } catch (e: any) {
      results[layer] = { error: String(e?.message ?? e) };
    }
  }
  const c = await getCampaign(campaignId);
  if (c && c.status !== "error") await setStatus(campaignId, "active");
  return results;
}
