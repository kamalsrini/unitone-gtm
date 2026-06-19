import { NextResponse } from "next/server";
import { globalMetrics } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json(await globalMetrics()); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e), needsInit: true }, { status: 200 }); }
}
