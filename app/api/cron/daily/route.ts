import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { runFullPipeline } from "@/lib/pipeline";
import { authorizedCron } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!authorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`SELECT id FROM campaigns WHERE status IN ('active','running') AND (config->>'instantly_campaign_id') IS NULL AND 1=0`;
    const out: Record<string, any> = {};
    for (const r of rows) out[r.id] = await runFullPipeline(Number(r.id));
    return NextResponse.json({ ok: true, ran: rows.length, out });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
