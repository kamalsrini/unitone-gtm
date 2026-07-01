import { NextResponse } from "next/server";
import { globalMetrics, listCampaigns } from "@/lib/db";
import { instantlyCampaignStats } from "@/lib/instantly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const m: any = await globalMetrics();
    // Blend live Instantly numbers for any campaign linked via config.instantly_campaign_id.
    const campaigns = await listCampaigns();
    for (const c of campaigns) {
      const iid = (c.config as any)?.instantly_campaign_id;
      if (!iid) continue;
      const live = await instantlyCampaignStats(iid);
      if (!live) continue;
      m.totals.sent = (m.totals.sent || 0) + live.sent;
      m.totals.opens = (m.totals.opens || 0) + live.opens;
      m.totals.clicks = (m.totals.clicks || 0) + live.clicks;
      m.totals.replies = (m.totals.replies || 0) + live.replies;
      m.totals.meetings = (m.totals.meetings || 0) + live.meetings;
      m.totals.contacts = (m.totals.contacts || 0) + live.leads;
      m.totals.enrolled = (m.totals.enrolled || 0) + live.leads;
    }
    return NextResponse.json(m, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e), needsInit: true }, { status: 200 }); }
}
