import { NextResponse } from "next/server";
import { listCampaigns, getStats } from "@/lib/db";
import { resolveLinkedCampaign, companiesForLinked } from "@/lib/campaign-live";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export async function GET() {
  try {
    const campaigns = await listCampaigns();
    const totals: any = { accounts: 0, signals: 0, contacts: 0, enrolled: 0, messages: 0, sent: 0, opens: 0, clicks: 0, replies: 0, meetings: 0 };
    const tiers: Record<string, number> = {};
    let active = 0;
    for (const c of campaigns) {
      if (c.status === "active" || c.status === "running") active++;
      const stats: any = await getStats(c.id);
      const iid = (c.config as any)?.instantly_campaign_id;
      if (iid) {
        const snap = await resolveLinkedCampaign(c.id, iid, c.config);
        const companies = companiesForLinked(iid, snap).length;
        stats.accounts = companies; stats.hot = companies; stats.warm = 0;
        stats.signals = 0; stats.messages = 0;
        stats.contacts = snap.leads; stats.enrolled = snap.leads;
        stats.sent = snap.sent; stats.opens = snap.opens; stats.clicks = snap.clicks;
        stats.replies = snap.replies; stats.meetings = snap.meetings;
        tiers["TIER 1 — HOT"] = (tiers["TIER 1 — HOT"] || 0) + companies;
      } else {
        tiers["TIER 1 — HOT"] = (tiers["TIER 1 — HOT"] || 0) + (stats.hot || 0);
        tiers["TIER 2 — WARM"] = (tiers["TIER 2 — WARM"] || 0) + (stats.warm || 0);
      }
      for (const k of ["accounts","signals","contacts","enrolled","messages","sent","opens","clicks","replies","meetings"]) {
        totals[k] += stats[k] || 0;
      }
    }
    return NextResponse.json({ campaigns: campaigns.length, activeCampaigns: active, tiers, totals }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) { return NextResponse.json({ error: String(e?.message ?? e), needsInit: true }, { status: 200 }); }
}
