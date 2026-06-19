import { NextResponse } from "next/server";
import { initSchema } from "@/lib/db";
import { authorizedCron } from "@/lib/env";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: Request) {
  if (!authorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try { return NextResponse.json(await initSchema()); }
  catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 }); }
}
export async function GET(req: Request) { return POST(req); }
