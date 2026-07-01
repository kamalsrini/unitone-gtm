import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { initSchema } from "@/lib/db";
import { authorizedCron } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const INSTANTLY_ID = "9e015ca5-dcf1-48f1-ae1a-3e31f87f815a";
const NAME = "Controls Top-5 (JCI-peer)";
const ACCOUNTS = [
  { name: "Honeywell", domain: "honeywell.com", tier: "TIER 1 — HOT" },
  { name: "Siemens", domain: "siemens.com", tier: "TIER 1 — HOT" },
  { name: "Schneider Electric", domain: "se.com", tier: "TIER 1 — HOT" },
  { name: "Rockwell Automation", domain: "rockwellautomation.com", tier: "TIER 2 — WARM" },
  { name: "Emerson", domain: "emerson.com", tier: "TIER 2 — WARM" },
];

export async function GET(req: Request) { return run(req); }
export async function POST(req: Request) { return run(req); }

async function run(req: Request) {
  if (!authorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await initSchema();
    const existing = await sql`SELECT id FROM campaigns WHERE name = ${NAME}`;
    let id: number;
    const cfg = JSON.stringify({ instantly_campaign_id: INSTANTLY_ID });
    if (existing.rows[0]) {
      id = existing.rows[0].id;
      await sql`UPDATE campaigns SET status='active', persona='vp_engineering', channel='email', config=${cfg}, updated_at=now() WHERE id=${id}`;
    } else {
      const ins = await sql`INSERT INTO campaigns (name, status, persona, channel, config, layer_state, auto_enroll)
        VALUES (${NAME}, 'active', 'vp_engineering', 'email', ${cfg}, '{}', false) RETURNING id`;
      id = ins.rows[0].id;
    }
    await sql`DELETE FROM accounts WHERE campaign_id = ${id}`;
    for (const a of ACCOUNTS) {
      await sql`INSERT INTO accounts (campaign_id, name, domain, tier, total_score, action)
        VALUES (${id}, ${a.name}, ${a.domain}, ${a.tier}, 90, 'Engage')`;
    }
    return NextResponse.json({ ok: true, campaignId: id, accounts: ACCOUNTS.length, instantly: INSTANTLY_ID });
  } catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 }); }
}
