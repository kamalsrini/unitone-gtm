/**
 * UnitOne GTM — Vercel Postgres data layer.
 * Schema + typed query helpers for campaigns and the 5-layer state.
 */
import { sql } from "@vercel/postgres";

export const LAYERS = [
  { key: "signals", label: "Signal Detection & Scoring", n: 1 },
  { key: "enroll", label: "Enrollment & Sequence Execution", n: 2 },
  { key: "content", label: "Content & Message Distribution", n: 3 },
  { key: "monitor", label: "Attribution & Monitoring", n: 4 },
  { key: "replies", label: "Response Handling & Follow-up", n: 5 },
] as const;

export type LayerKey = (typeof LAYERS)[number]["key"];
export type CampaignStatus = "draft" | "running" | "active" | "paused" | "error";
export type LayerState = "pending" | "running" | "done" | "error";

export interface Campaign {
  id: number;
  name: string;
  status: CampaignStatus;
  persona: string;
  channel: string;
  config: any;
  layer_state: Record<LayerKey, LayerState>;
  sequence_id: string | null;
  auto_enroll: boolean;
  created_at: string;
  updated_at: string;
}

export async function initSchema() {
  await sql`CREATE TABLE IF NOT EXISTS campaigns (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    persona TEXT NOT NULL DEFAULT 'vp_engineering',
    channel TEXT NOT NULL DEFAULT 'email',
    config JSONB NOT NULL DEFAULT '{}',
    layer_state JSONB NOT NULL DEFAULT '{}',
    sequence_id TEXT,
    auto_enroll BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT, domain TEXT, segment TEXT,
    total_score INT, tier TEXT, action TEXT,
    firmographic_score INT, technographic_score INT, intent_score INT,
    breakdown JSONB, matched_signals INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
    company TEXT, domain TEXT, signal_type TEXT, signal_strength TEXT,
    detail TEXT, url TEXT, source TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS contacts (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
    account_id INT,
    apollo_id TEXT, name TEXT, title TEXT, persona TEXT,
    company TEXT, domain TEXT, email TEXT, linkedin_url TEXT,
    status TEXT NOT NULL DEFAULT 'found',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INT, company TEXT, persona TEXT,
    subject TEXT, body TEXT, linkedin TEXT,
    asset_type TEXT, asset_url TEXT, cta TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    campaign_id INT REFERENCES campaigns(id) ON DELETE CASCADE,
    contact_id INT, type TEXT, detail TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  await sql`CREATE TABLE IF NOT EXISTS replies (
    id SERIAL PRIMARY KEY,
    campaign_id INT,
    external_id TEXT UNIQUE,
    from_email TEXT, subject TEXT, body TEXT,
    intent TEXT, urgency TEXT, summary TEXT, suggested_reply TEXT,
    handled BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`;
  return { ok: true };
}

const DEFAULT_LAYER_STATE: Record<LayerKey, LayerState> = {
  signals: "pending", enroll: "pending", content: "pending", monitor: "pending", replies: "pending",
};

export async function createCampaign(input: {
  name: string; persona: string; channel: string; config: any;
  sequenceId?: string | null; autoEnroll?: boolean;
}): Promise<Campaign> {
  const { rows } = await sql`
    INSERT INTO campaigns (name, persona, channel, config, layer_state, sequence_id, auto_enroll, status)
    VALUES (${input.name}, ${input.persona}, ${input.channel},
            ${JSON.stringify(input.config)}, ${JSON.stringify(DEFAULT_LAYER_STATE)},
            ${input.sequenceId ?? null}, ${input.autoEnroll ?? false}, 'draft')
    RETURNING *`;
  return rows[0] as Campaign;
}

export async function listCampaigns(): Promise<Campaign[]> {
  const { rows } = await sql`SELECT * FROM campaigns ORDER BY created_at DESC`;
  return rows as Campaign[];
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  const { rows } = await sql`SELECT * FROM campaigns WHERE id = ${id}`;
  return (rows[0] as Campaign) ?? null;
}

export async function setLayerState(id: number, layer: LayerKey, state: LayerState) {
  await sql`UPDATE campaigns
    SET layer_state = jsonb_set(layer_state, ${"{" + layer + "}"}, ${JSON.stringify(state)}::jsonb),
        updated_at = now()
    WHERE id = ${id}`;
}

export async function setStatus(id: number, status: CampaignStatus) {
  await sql`UPDATE campaigns SET status = ${status}, updated_at = now() WHERE id = ${id}`;
}

export async function getStats(id: number) {
  const [{ rows: a }, { rows: s }, { rows: c }, { rows: m }, { rows: ev }, { rows: rp }] = await Promise.all([
    sql`SELECT count(*)::int n, count(*) FILTER (WHERE tier LIKE 'TIER 1%')::int hot,
               count(*) FILTER (WHERE tier LIKE 'TIER 2%')::int warm FROM accounts WHERE campaign_id=${id}`,
    sql`SELECT count(*)::int n FROM signals WHERE campaign_id=${id}`,
    sql`SELECT count(*)::int n, count(*) FILTER (WHERE status='enrolled')::int enrolled FROM contacts WHERE campaign_id=${id}`,
    sql`SELECT count(*)::int n FROM messages WHERE campaign_id=${id}`,
    sql`SELECT count(*) FILTER (WHERE type='sent')::int sent, count(*) FILTER (WHERE type='open')::int opens,
               count(*) FILTER (WHERE type='click')::int clicks FROM events WHERE campaign_id=${id}`,
    sql`SELECT count(*)::int n, count(*) FILTER (WHERE intent='MEETING')::int meetings FROM replies WHERE campaign_id=${id}`,
  ]);
  return {
    accounts: a[0]?.n ?? 0, hot: a[0]?.hot ?? 0, warm: a[0]?.warm ?? 0,
    signals: s[0]?.n ?? 0,
    contacts: c[0]?.n ?? 0, enrolled: c[0]?.enrolled ?? 0,
    messages: m[0]?.n ?? 0,
    sent: ev[0]?.sent ?? 0, opens: ev[0]?.opens ?? 0, clicks: ev[0]?.clicks ?? 0,
    replies: rp[0]?.n ?? 0, meetings: rp[0]?.meetings ?? 0,
  };
}

export async function globalMetrics() {
  const { rows: campaignRows } = await sql`SELECT count(*)::int n, count(*) FILTER (WHERE status='active')::int active FROM campaigns`;
  const { rows: t } = await sql`SELECT tier, count(*)::int n FROM accounts GROUP BY tier`;
  const { rows: tot } = await sql`SELECT
      (SELECT count(*)::int FROM accounts) accounts,
      (SELECT count(*)::int FROM signals) signals,
      (SELECT count(*)::int FROM contacts) contacts,
      (SELECT count(*)::int FROM contacts WHERE status='enrolled') enrolled,
      (SELECT count(*)::int FROM messages) messages,
      (SELECT count(*)::int FROM events WHERE type='sent') sent,
      (SELECT count(*)::int FROM events WHERE type='open') opens,
      (SELECT count(*)::int FROM events WHERE type='click') clicks,
      (SELECT count(*)::int FROM replies) replies,
      (SELECT count(*)::int FROM replies WHERE intent='MEETING') meetings`;
  return {
    campaigns: campaignRows[0]?.n ?? 0,
    activeCampaigns: campaignRows[0]?.active ?? 0,
    tiers: Object.fromEntries(t.map((r: any) => [r.tier, r.n])),
    totals: tot[0] ?? {},
  };
}
