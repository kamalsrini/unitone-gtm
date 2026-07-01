import { NextResponse } from "next/server";
import { runLayer, runFullPipeline } from "@/lib/pipeline";
import type { LayerKey } from "@/lib/db";
import { getCampaign } from "@/lib/db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cid = Number(id);
  const body = await req.json().catch(() => ({}));
  const camp = await getCampaign(cid);
  if ((camp?.config as any)?.instantly_campaign_id) {
    return NextResponse.json({ ok: false, error: "Campaign is linked to Instantly — the simulation pipeline is disabled for it." }, { status: 400 });
  }
  try {
    if (body?.layer) {
      const result = await runLayer(cid, body.layer as LayerKey);
      return NextResponse.json({ ok: true, layer: body.layer, result });
    }
    const results = await runFullPipeline(cid);
    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e?.message ?? e) }, { status: 500 });
  }
}
