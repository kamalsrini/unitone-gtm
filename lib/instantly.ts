/** Live Instantly campaign stats for the dashboard funnel (read-only). */
const IBASE = "https://api.instantly.ai/api/v2";
function ihdr() {
  return { Authorization: `Bearer ${process.env.INSTANTLY_API_KEY || ""}`, "User-Agent": "curl/8.4.0", Accept: "application/json" };
}
export function instantlyConfigured() { return !!process.env.INSTANTLY_API_KEY; }
async function iget(p: string) { const r = await fetch(IBASE + p, { headers: ihdr(), cache: "no-store" }); if (!r.ok) throw new Error(`Instantly ${r.status}`); return r.json(); }
async function ipost(p: string, b: any) { const r = await fetch(IBASE + p, { method: "POST", headers: { ...ihdr(), "Content-Type": "application/json" }, body: JSON.stringify(b), cache: "no-store" }); if (!r.ok) throw new Error(`Instantly ${r.status}`); return r.json(); }

export interface InstantlyLive { sent: number; opens: number; clicks: number; replies: number; meetings: number; interested: number; bounced: number; leads: number; byCompany: Record<string, number>; }

export async function instantlyCampaignStats(campaignId: string): Promise<InstantlyLive | null> {
  if (!instantlyConfigured() || !campaignId) return null;
  try {
    // Instantly's overview intermittently returns 0 from serverless IPs — retry and keep the real value.
    // `reached` tracks whether Instantly answered at all; if nothing succeeded (e.g. 402 inactive plan,
    // network), we return null so callers can show an honest "unavailable" state instead of fake zeros.
    let o: any = {};
    let reached = false;
    for (let i = 0; i < 3; i++) {
      try {
        const r = await iget(`/campaigns/analytics/overview?id=${campaignId}`);
        reached = true;
        if ((r?.emails_sent_count || 0) >= (o?.emails_sent_count || 0)) o = r;
        if ((r?.emails_sent_count || 0) > 0) break;
      } catch {}
    }
    let leads: any[] = [];
    try { leads = (await ipost(`/leads/list`, { campaign: campaignId, limit: 100 })).items ?? []; reached = true; } catch {}
    if (!reached) return null;
    const byCompany: Record<string, number> = {};
    for (const l of leads) { const c = l.company_name || "—"; byCompany[c] = (byCompany[c] || 0) + 1; }
    return {
      sent: o.emails_sent_count || 0, opens: o.open_count_unique || 0, clicks: o.link_click_count_unique || 0,
      replies: o.reply_count_unique || 0, meetings: o.total_meeting_booked || 0, interested: o.total_interested || 0,
      bounced: o.bounced_count || 0, leads: leads.length, byCompany,
    };
  } catch { return null; }
}

export interface InstantlyLead { company: string; email: string; first_name: string; last_name: string; status: any; }
export async function instantlyCampaignLeads(campaignId: string): Promise<InstantlyLead[]> {
  if (!instantlyConfigured() || !campaignId) return [];
  try {
    const r = await ipost(`/leads/list`, { campaign: campaignId, limit: 100 });
    return (r.items ?? []).map((l: any) => ({
      company: l.company_name || "", email: l.email || "",
      first_name: l.first_name || "", last_name: l.last_name || "", status: l.status,
    }));
  } catch { return []; }
}

export interface InstantlyStep { step: number; delay: number; variants: { subject: string; body: string }[]; }
export async function instantlyCampaignSequence(campaignId: string): Promise<InstantlyStep[]> {
  if (!instantlyConfigured() || !campaignId) return [];
  try {
    const c = await iget(`/campaigns/${campaignId}`);
    const steps = c?.sequences?.[0]?.steps ?? [];
    return steps.map((st: any, i: number) => ({
      step: i + 1, delay: st.delay ?? 0,
      variants: (st.variants ?? []).map((v: any) => ({ subject: v.subject || "", body: v.body || "" })),
    }));
  } catch { return []; }
}

export async function updateInstantlyCampaignSequence(campaignId: string, steps: any[]): Promise<boolean> {
  if (!instantlyConfigured() || !campaignId) return false;
  try {
    const payload = { sequences: [{ steps: (steps || []).map((st: any) => ({
      type: "email", delay: st.delay ?? 0, delay_unit: "days", pre_delay_unit: "days",
      variants: (st.variants ?? []).map((v: any) => ({ subject: v.subject || "", body: v.body || "" })),
    })) }] };
    const res = await fetch(`${IBASE}/campaigns/${campaignId}`, {
      method: "PATCH", headers: { ...ihdr(), "Content-Type": "application/json" },
      body: JSON.stringify(payload), cache: "no-store",
    });
    return res.ok;
  } catch { return false; }
}
