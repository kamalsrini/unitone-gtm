import { NextResponse } from "next/server";
import { listSequences, apolloConfigured } from "@/lib/apollo";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  if (!apolloConfigured()) return NextResponse.json({ sequences: [], configured: false });
  return NextResponse.json({ sequences: await listSequences(), configured: true });
}
