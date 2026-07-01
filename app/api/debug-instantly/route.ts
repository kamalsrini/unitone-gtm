import { NextResponse } from "next/server";
import { instantlyCampaignStats } from "@/lib/instantly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const ID = "9e015ca5-dcf1-48f1-ae1a-3e31f87f815a";
async function rawSent() {
  const h = { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY || ""}`, "User-Agent": "curl/8.4.0", Accept: "application/json" };
  const res = await fetch(`https://api.instantly.ai/api/v2/campaigns/analytics/overview?id=${ID}`, { headers: h, cache: "no-store" });
  const j = await res.json();
  return j.emails_sent_count;
}
export async function GET() {
  const out: any = {};
  out.rawSentA = await rawSent();
  out.viaStats = await instantlyCampaignStats(ID);
  out.rawSentB = await rawSent();
  return NextResponse.json(out, { headers: { "Cache-Control": "no-store" } });
}
