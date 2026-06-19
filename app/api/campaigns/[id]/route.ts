import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { getCampaign, getStats } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  return NextResponse.json({
    campaign, stats,
    accounts: accounts.rows, signals: signals.rows, contacts: contacts.rows,
    messages: messages.rows, replies: replies.rows,
  });
}
