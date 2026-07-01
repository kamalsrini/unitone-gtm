import { NextResponse } from "next/server";
import { getCampaign } from "@/lib/db";
import { instantlyCampaignSequence, updateInstantlyCampaignSequence } from "@/lib/instantly";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function linkedId(cid: number) {
  const c = await getCampaign(cid);
  return (c?.config as any)?.instantly_campaign_id as string | undefined;
}
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const iid = await linkedId(Number(id));
  if (!iid) return NextResponse.json({ steps: [], linked: false }, { headers: { "Cache-Control": "no-store" } });
  return NextResponse.json({ steps: await instantlyCampaignSequence(iid), linked: true }, { headers: { "Cache-Control": "no-store" } });
}
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const iid = await linkedId(Number(id));
  if (!iid) return NextResponse.json({ ok: false, error: "not linked to Instantly" }, { status: 400 });
  const body = await req.json().catch(() => ({}));
  const ok = await updateInstantlyCampaignSequence(iid, body.steps ?? []);
  return NextResponse.json({ ok }, { headers: { "Cache-Control": "no-store" } });
}
