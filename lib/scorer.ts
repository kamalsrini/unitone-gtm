/**
 * UnitOne GTM Engine — ICP Scoring Engine (ported from gtm_engine/scorer.py)
 * Firmographic (0-40) + Technographic (0-30) + Intent (0-30) = 0-100.
 */
import { SCORING, TIERS, TIER_LABELS, tierAction, NamedAccount } from "./config";

export interface AccountInput extends NamedAccount {
  employee_count?: number;
  annual_revenue?: number;
  funding_stage?: string;
  technologies?: string[];
}

export interface SignalRow {
  company: string;
  domain: string;
  signal_type: string;
  signal_strength: string; // HIGH | MEDIUM | LOW
  detail?: string;
  url?: string;
  source?: string;
}

export interface ScoredAccount {
  name: string;
  domain: string;
  segment: string;
  total_score: number;
  tier: string;
  action: string;
  firmographic_score: number;
  technographic_score: number;
  intent_score: number;
  breakdown: {
    firmographic: Record<string, number>;
    technographic: Record<string, number>;
    intent: Record<string, number>;
  };
  matched_signals: number;
}

function scoreFirmographic(a: AccountInput): [number, Record<string, number>] {
  let score = 0;
  const b: Record<string, number> = {};
  const eng = Number(a.employee_count ?? 0);
  const es = SCORING.firmographic.engineer_count;
  let s =
    eng >= 1000 && eng <= 5000 ? es["1000-5000"]
    : eng >= 500 && eng < 1000 ? es["500-999"]
    : eng >= 200 && eng < 500 ? es["200-499"]
    : eng >= 100 && eng < 200 ? es["100-199"]
    : 0;
  score += s; b.engineer_count = s;

  s = SCORING.firmographic.segment[a.segment] ?? 0;
  score += s; b.segment = s;

  const rev = Number(a.annual_revenue ?? 0);
  const rs = SCORING.firmographic.revenue_band;
  s = rev >= 100_000_000 ? rs["100M-1B"]
    : rev >= 50_000_000 ? rs["50M-100M"]
    : rev >= 20_000_000 ? rs["20M-50M"]
    : rev >= 10_000_000 ? rs["10M-20M"]
    : 0;
  score += s; b.revenue_band = s;

  const f = (a.funding_stage ?? "").toLowerCase();
  const fs = SCORING.firmographic.funding_stage;
  s = f.includes("public") || f.includes("ipo") ? fs.public
    : ["series c", "series d", "series e", "series f", "growth"].some((x) => f.includes(x)) ? fs.series_c_plus
    : f.includes("series b") ? fs.series_b
    : f.includes("series a") ? fs.series_a
    : f.includes("seed") ? fs.seed
    : 0;
  score += s; b.funding_stage = s;
  return [score, b];
}

function scoreTechnographic(a: AccountInput): [number, Record<string, number>] {
  let score = 0;
  const b: Record<string, number> = {};
  const tech = (a.technologies ?? []).map((t) => t.toLowerCase());
  const ts = SCORING.technographic.security_tooling;
  const hasSnyk = tech.some((t) => t.includes("snyk"));
  const hasVeracode = tech.some((t) => t.includes("veracode"));
  const hasSast = tech.some((t) => ["sonarqube", "checkmarx", "fortify", "semgrep", "sast"].includes(t));
  let s = hasSnyk && hasVeracode ? ts.snyk_and_veracode
    : hasSnyk || hasVeracode ? ts.snyk_or_veracode
    : hasSast ? ts.basic_sast : ts.none_detected;
  score += s; b.security_tooling = s;

  const cs = SCORING.technographic.cicd_maturity;
  const hasGha = tech.some((t) => t.includes("github actions") || t.includes("github"));
  const hasK8s = tech.some((t) => t.includes("kubernetes") || t.includes("k8s"));
  const hasDocker = tech.some((t) => t.includes("docker"));
  const hasJenkins = tech.some((t) => t.includes("jenkins"));
  s = (hasGha || hasJenkins) && hasK8s ? cs.github_actions_k8s
    : hasGha && hasDocker ? cs.github_actions_docker
    : hasGha || hasJenkins ? cs.basic_ci : cs.none_detected;
  score += s; b.cicd_maturity = s;

  const as_ = SCORING.technographic.ai_adoption;
  const hasCopilot = tech.some((t) => ["github copilot", "copilot", "cursor", "claude"].includes(t));
  const hasAi = tech.some((t) => ["openai", "chatgpt", "ai", "ml"].includes(t));
  s = hasCopilot ? as_.copilot_cursor_claude : hasAi ? as_.evaluating : as_.none_detected;
  score += s; b.ai_adoption = s;
  return [score, b];
}

function scoreIntent(a: AccountInput, signals: SignalRow[]): [number, Record<string, number>, number] {
  let score = 0;
  const b: Record<string, number> = {};
  const acct = signals.filter(
    (s) =>
      s.company?.toLowerCase() === a.name.toLowerCase() ||
      (!!s.domain && s.domain.toLowerCase() === a.domain.toLowerCase())
  );

  const hs = SCORING.intent.hiring_security;
  const hiring = acct.filter((s) => (s.signal_type ?? "").includes("hiring"));
  let s = hiring.some((x) => x.signal_strength === "HIGH") ? hs.vp_security_hired
    : hiring.length ? hs.security_engineer_posting : hs.none;
  score += s; b.hiring_security = s;

  const fg = SCORING.intent.funding_growth;
  const funding = acct.filter((s) => (s.signal_type ?? "").includes("funding"));
  s = funding.some((x) => x.signal_strength === "HIGH") ? fg.raised_50m_plus
    : funding.length ? fg.raised_10_50m : fg.none;
  score += s; b.funding_growth = s;

  const lc = SCORING.intent.leadership_change;
  const lead = acct.filter((s) => (s.signal_type ?? "").includes("leadership") || (s.signal_type ?? "").includes("github"));
  s = lead.some((x) => x.signal_strength === "HIGH") ? lc.new_cto_vp_eng
    : lead.length ? lc.eng_reorg : lc.none;
  score += s; b.leadership_change = s;
  return [score, b, acct.length];
}

export function assignTier(total: number): string {
  if (total >= TIERS.tier_1_hot) return TIER_LABELS.HOT;
  if (total >= TIERS.tier_2_warm) return TIER_LABELS.WARM;
  if (total >= TIERS.tier_3_nurture) return TIER_LABELS.NURTURE;
  return TIER_LABELS.WATCH;
}

export function scoreAccount(a: AccountInput, signals: SignalRow[] = []): ScoredAccount {
  const [firm, fb] = scoreFirmographic(a);
  const [tech, tb] = scoreTechnographic(a);
  const [intent, ib, matched] = scoreIntent(a, signals);
  const total = firm + tech + intent;
  const tier = assignTier(total);
  return {
    name: a.name, domain: a.domain, segment: a.segment,
    total_score: total, tier, action: tierAction(tier),
    firmographic_score: firm, technographic_score: tech, intent_score: intent,
    breakdown: { firmographic: fb, technographic: tb, intent: ib },
    matched_signals: matched,
  };
}

export function scoreAllAccounts(accounts: AccountInput[], signals: SignalRow[] = []): ScoredAccount[] {
  return accounts.map((a) => scoreAccount(a, signals)).sort((x, y) => y.total_score - x.total_score);
}
