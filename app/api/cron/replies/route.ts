import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { runLayer } from "@/lib/pipeline";
import { authorizedCron } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  if (!authorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { rows } = await sql`SELECT id FROM campaigns WHERE status IN ('active','running')`;
    let total = 0;
    for (const r of rows) { const res = await runLayer(Number(r.id), "replies"); total += res?.replies ?? 0; }
    return NextResponse.json({ ok: true, campaigns: rows.length, newReplies: total });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
