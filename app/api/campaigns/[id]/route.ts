import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCampaign, getStats } from "@/lib/db";
import { instantlyCampaignStats, instantlyCampaignLeads, instantlyCampaignSequence } from "@/lib/instantly";
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
  };

  const iid = (campaign.config as any)?.instantly_campaign_id;
  if (iid) {
    const [live, leads, seq] = await Promise.all([
      instantlyCampaignStats(iid), instantlyCampaignLeads(iid), instantlyCampaignSequence(iid),
    ]);
    out.sequence = seq;
    if (live) {
      out.stats = { ...stats, sent: live.sent, opens: live.opens, clicks: live.clicks,
        replies: live.replies, meetings: live.meetings, contacts: live.leads, enrolled: live.leads };
    }
    if (leads.length) {
      // Real Instantly leads become the contacts list
      out.contacts = leads.map((l, i) => ({
        id: `i${i}`, name: `${l.first_name} ${l.last_name}`.trim() || l.email,
        title: "", company: l.company, email: l.email, status: "enrolled",
      }));
      // Real companies (deduped) become the accounts list — keep seeded tier where present
      const seeded: Record<string, any> = {};
      for (const a of accounts.rows as any[]) seeded[a.name] = a;
      const seen = new Set<string>();
      out.accounts = [];
      for (const l of leads) {
        if (!l.company || seen.has(l.company)) continue;
        seen.add(l.company);
        out.accounts.push(seeded[l.company] ?? {
          id: `ic-${l.company}`, name: l.company, domain: "", tier: "TIER 1 — HOT",
          total_score: 90, firmographic_score: null, technographic_score: null,
          intent_score: null, matched_signals: null, action: "In sequence",
        });
      }
      out.accounts = out.accounts.map((a: any) => ({ ...a, tier: "TIER 1 — HOT" }));
      out.signals = [];
      out.messages = [];
      out.stats = { ...out.stats, accounts: out.accounts.length, hot: out.accounts.length, warm: 0, signals: 0, messages: 0 };
    }
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
