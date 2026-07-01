/** Live Instantly campaign stats for the dashboard funnel (read-only). */
const IBASE = "https://api.instantly.ai/api/v2";
function ihdr() {
  return { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY || ""}`, "User-Agent": "unitone-gtm/1.0", Accept: "application/json" };
}
export function instantlyConfigured() { return !!process.env.INSTANTLY_API_KEY; }
async function iget(p: string) { const r = await fetch(IBASE + p, { headers: ihdr(), cache: "no-store" }); if (!r.ok) throw new Error(`Instantly ${r.status}`); return r.json(); }
async function ipost(p: string, b: any) { const r = await fetch(IBASE + p, { method: "POST", headers: { ...ihdr(), "Content-Type": "application/json" }, body: JSON.stringify(b), cache: "no-store" }); if (!r.ok) throw new Error(`Instantly ${r.status}`); return r.json(); }

export interface InstantlyLive { sent: number; opens: number; clicks: number; replies: number; meetings: number; interested: number; bounced: number; leads: number; byCompany: Record<string, number>; }

export async function instantlyCampaignStats(campaignId: string): Promise<InstantlyLive | null> {
  if (!instantlyConfigured() || !campaignId) return null;
  try {
    const o = await iget(`/campaigns/analytics/overview?id=${campaignId}`);
    let leads: any[] = [];
    try { leads = (await ipost(`/leads/list`, { campaign: campaignId, limit: 100 })).items ?? []; } catch {}
    const byCompany: Record<string, number> = {};
    for (const l of leads) { const c = l.company_name || "—"; byCompany[c] = (byCompany[c] || 0) + 1; }
    return {
      sent: o.emails_sent_count || 0, opens: o.open_count_unique || 0, clicks: o.link_click_count_unique || 0,
      replies: o.reply_count_unique || 0, meetings: o.total_meeting_booked || 0, interested: o.total_interested || 0,
      bounced: o.bounced_count || 0, leads: leads.length, byCompany,
    };
  } catch { return null; }
}
