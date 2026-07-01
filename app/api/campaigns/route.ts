import { NextResponse } from "next/server";
import { createCampaign, listCampaigns, getStats, initSchema } from "@/lib/db";
import { instantlyCampaignStats } from "@/lib/instantly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const withStats = await Promise.all(campaigns.map(async (c) => {
      const stats: any = await getStats(c.id);
      const iid = (c.config as any)?.instantly_campaign_id;
      if (iid) {
        const live = await instantlyCampaignStats(iid);
        if (live) {
          stats.sent = live.sent; stats.opens = live.opens; stats.clicks = live.clicks;
          stats.replies = live.replies; stats.meetings = live.meetings;
          stats.contacts = Math.max(stats.contacts, live.leads);
          stats.enrolled = Math.max(stats.enrolled, live.leads);
        }
      }
      return { ...c, stats };
    }));
    return NextResponse.json({ campaigns: withStats }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json({ campaigns: [], needsInit: true, error: String(e?.message ?? e) });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    await initSchema();
    const c = await createCampaign({
      name: body.name,
      persona: body.persona ?? "vp_engineering",
      channel: body.channel ?? "email",
      config: { segments: body.segments ?? [], accounts: body.accounts ?? [] },
      sequenceId: body.sequenceId ?? null,
      autoEnroll: !!body.autoEnroll,
    });
    return NextResponse.json({ campaign: c });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
