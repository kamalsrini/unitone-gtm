import { NextResponse } from "next/server";
import { createCampaign, listCampaigns, getStats, initSchema } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const withStats = await Promise.all(campaigns.map(async (c) => ({ ...c, stats: await getStats(c.id) })));
    return NextResponse.json({ campaigns: withStats });
  } catch (e: any) {
    return NextResponse.json({ campaigns: [], needsInit: true, error: String(e?.message ?? e) });
  }
}

export async function POST(req: Request) {
  const body = await req.json();
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 400 });
  try {
    await initSchema(); // idempotent — guarantees tables exist on first run
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
