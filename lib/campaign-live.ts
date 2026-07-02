import { sql } from "@vercel/postgres";
import { instantlyCampaignStats } from "./instantly";

/**
 * Guaranteed real-account fallback per Instantly campaign id. For a linked campaign we
 * ALWAYS render these companies (or live leads), never the raw `accounts` table — which
 * can hold leftover simulation/demo rows (Brex, Datadog, …). This is what keeps demo data
 * from ever appearing again on a linked campaign.
 */
export const REAL_ACCOUNTS: Record<string, { name: string; domain: string; tier: string }[]> = {
  "9e015ca5-dcf1-48f1-ae1a-3e31f87f815a": [
    { name: "Honeywell", domain: "honeywell.com", tier: "TIER 1 — HOT" },
    { name: "Siemens", domain: "siemens.com", tier: "TIER 1 — HOT" },
    { name: "Schneider Electric", domain: "se.com", tier: "TIER 1 — HOT" },
    { name: "Rockwell Automation", domain: "rockwellautomation.com", tier: "TIER 2 — WARM" },
    { name: "Emerson", domain: "emerson.com", tier: "TIER 2 — WARM" },
  ],
};

export interface LiveSnapshot {
  sent: number; opens: number; clicks: number; replies: number; meetings: number;
  interested: number; bounced: number; leads: number;
  byCompany: Record<string, number>;
  updatedAt: string | null;
  /** live = fresh from Instantly; cache = last good snapshot; unavailable = Instantly down/402 & no cache */
  source: "live" | "cache" | "unavailable";
}

/**
 * Resolve stats for a linked campaign, resilient to Instantly flakiness / 402 (inactive plan).
 * - Try live. If Instantly answers (not null), cache it to config.instantly_snapshot and use it.
 * - If live is null (unreachable/402), fall back to the cached snapshot.
 * - If neither, return zeros marked `unavailable` so the UI can say so honestly.
 * Never invents numbers; never reads the pollutable accounts table.
 */
export async function resolveLinkedCampaign(
  campaignId: number,
  iid: string,
  existingConfig: any
): Promise<LiveSnapshot> {
  const cached: any = existingConfig?.instantly_snapshot || null;
  const live = await instantlyCampaignStats(iid);

  if (live) {
    const snap: LiveSnapshot = {
      sent: live.sent, opens: live.opens, clicks: live.clicks, replies: live.replies,
      meetings: live.meetings, interested: live.interested, bounced: live.bounced,
      leads: live.leads, byCompany: live.byCompany || {},
      updatedAt: new Date().toISOString(), source: "live",
    };
    // Persist as last-known-good (best effort). Only overwrite when this pull carries real
    // signal (sent or leads), so a transient empty-but-200 doesn't wipe a good cache.
    if (snap.sent > 0 || snap.leads > 0) {
      try {
        await sql`UPDATE campaigns
          SET config = jsonb_set(coalesce(config,'{}'::jsonb), '{instantly_snapshot}', ${JSON.stringify(snap)}::jsonb)
          WHERE id = ${campaignId}`;
      } catch {}
      return snap;
    }
    if (cached && (cached.sent > 0 || cached.leads > 0)) return { ...cached, source: "cache" };
    return snap;
  }

  // live === null → Instantly unreachable (down, rate-limited, or 402 inactive plan)
  if (cached) return { ...cached, source: "cache" };
  return {
    sent: 0, opens: 0, clicks: 0, replies: 0, meetings: 0, interested: 0, bounced: 0,
    leads: 0, byCompany: {}, updatedAt: null, source: "unavailable",
  };
}

/** Company list for a linked campaign: live/cache companies if present, else the real seed list. */
export function companiesForLinked(iid: string, snap: LiveSnapshot): string[] {
  const live = Object.keys(snap.byCompany || {}).filter(Boolean);
  if (live.length) return live;
  return (REAL_ACCOUNTS[iid] || []).map((a) => a.name);
}
