import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCampaign, getStats } from "@/lib/db";
import { instantlyCampaignLeads, instantlyCampaignSequence } from "@/lib/instantly";
import { resolveLinkedCampaign, companiesForLinked, REAL_ACCOUNTS } from "@/lib/campaign-live";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const campaign = await getCampaign(cid);
  if (!campaign) return NextResponse.json({ error: "not found" }, { status: 404 });
  const [stats, accounts, signals, contacts, messages, replies] = await Promise.all([
    getStats(cid),
    sql`SELECT * FROM accounts WHERE campaign_id=${cid} ORDER BY total_score DESC`,
    sql`SELECT * FROM signals WHERE campaign_id=${cid} ORDER BY signal_strength DESC, created_at DESC`,
    sql`SELECT * FROM contacts WHERE campaign_id=${cid} ORDER BY created_at DESC`,
    sql`SELECT * FROM messages WHERE campaign_id=${cid} ORDER BY created_at DESC`,
    sql`SELECT * FROM replies WHERE campaign_id=${cid} ORDER BY created_at DESC`,
  ]);

  const out: any = {
    campaign, stats,
    accounts: accounts.rows, signals: signals.rows, contacts: contacts.rows,
    messages: messages.rows, replies: replies.rows, sequence: [],
    dataStatus: "local", dataUpdatedAt: null,
  };

  const iid = (campaign.config as any)?.instantly_campaign_id;
  if (iid) {
    // Stats: live → cached snapshot → honest "unavailable". Never demo pollution.
    const snap = await resolveLinkedCampaign(cid, iid, campaign.config);
    out.dataStatus = snap.source;               // live | cache | unavailable
    out.dataUpdatedAt = snap.updatedAt;
    out.stats = { ...stats, sent: snap.sent, opens: snap.opens, clicks: snap.clicks,
      replies: snap.replies, meetings: snap.meetings, contacts: snap.leads, enrolled: snap.leads };

    // Accounts: real companies (live leads if present, else the seeded real list). Never the accounts table.
    const meta: Record<string, any> = Object.fromEntries((REAL_ACCOUNTS[iid] || []).map((a) => [a.name, a]));
    const names = companiesForLinked(iid, snap);
    out.accounts = names.map((name, i) => ({
      id: `ic-${i}`, name, domain: meta[name]?.domain || "",
      tier: meta[name]?.tier || "TIER 1 — HOT", total_score: 90,
      firmographic_score: null, technographic_score: null, intent_score: null,
      matched_signals: null, action: "In sequence",
    }));

    // Sequence: live, cached to config so "what messaging is used" stays visible even when Instantly is down.
    let seq = await instantlyCampaignSequence(iid);
    if (seq.length) {
      try { await sql`UPDATE campaigns SET config = jsonb_set(coalesce(config,'{}'::jsonb), '{instantly_sequence}', ${JSON.stringify(seq)}::jsonb) WHERE id = ${cid}`; } catch {}
    } else {
      seq = (campaign.config as any)?.instantly_sequence || [];
    }
    out.sequence = seq;

    // Contacts: live leads only (no fabrication when Instantly is down).
    const leads = await instantlyCampaignLeads(iid);
    out.contacts = leads.length
      ? leads.map((l, i) => ({ id: `i${i}`, name: `${l.first_name} ${l.last_name}`.trim() || l.email, title: "", company: l.company, email: l.email, status: "enrolled" }))
      : [];

    out.signals = [];
    out.messages = [];
    const hot = out.accounts.filter((a: any) => String(a.tier).includes("HOT")).length;
    out.stats = { ...out.stats, accounts: out.accounts.length, hot, warm: out.accounts.length - hot, signals: 0, messages: 0 };
  }
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}


export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const body = await req.json().catch(() => ({}));
  if (!body?.layer) return NextResponse.json({ error: "layer required" }, { status: 400 });
  const key = "{" + String(body.layer) + "}";
  await sql`UPDATE campaigns SET config = jsonb_set(coalesce(config, '{}'::jsonb), ${key}, ${JSON.stringify(body.config ?? {})}::jsonb), updated_at = now() WHERE id = ${cid}`;
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
