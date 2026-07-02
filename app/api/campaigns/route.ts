import { NextResponse } from "next/server";
import { createCampaign, listCampaigns, getStats, initSchema } from "@/lib/db";
import { resolveLinkedCampaign, companiesForLinked } from "@/lib/campaign-live";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const withStats = await Promise.all(campaigns.map(async (c) => {
      const stats: any = await getStats(c.id);
      const iid = (c.config as any)?.instantly_campaign_id;
      if (iid) {
        const snap = await resolveLinkedCampaign(c.id, iid, c.config);
        stats.sent = snap.sent; stats.opens = snap.opens; stats.clicks = snap.clicks;
        stats.replies = snap.replies; stats.meetings = snap.meetings;
        stats.contacts = Math.max(stats.contacts || 0, snap.leads);
        stats.enrolled = Math.max(stats.enrolled || 0, snap.leads);
        const companies = companiesForLinked(iid, snap).length;
        if (companies) { stats.accounts = companies; stats.hot = companies; stats.warm = 0; stats.signals = 0; stats.messages = 0; }
        return { ...c, stats, dataStatus: snap.source };
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
      config: {
        segments: body.segments ?? [],
        accounts: body.accounts ?? [],
        ...(body.brief ? { brief: body.brief } : {}),
        ...(body.layers && typeof body.layers === "object"
          ? Object.fromEntries(
              (["signals", "enroll", "replies"] as const)
                .filter((k) => body.layers[k] && typeof body.layers[k] === "object")
                .map((k) => [k, body.layers[k]])
            )
          : {}),
      },
      sequenceId: body.sequenceId ?? null,
      autoEnroll: !!body.autoEnroll,
    });
    return NextResponse.json({ campaign: c });
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
