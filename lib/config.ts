/**
 * UnitOne GTM Engine — Configuration (ported from gtm_engine/config.py)
 * All ICP criteria, scoring weights, personas, and account lists live here.
 */

export type Segment = "modern_tech" | "hybrid_tech" | "one_of_a_kind" | "traditional_tech";
export type PersonaKey = "vp_engineering" | "cto" | "cfo" | "ceo";

export interface NamedAccount {
  name: string;
  domain: string;
  segment: Segment;
}

export const ICP = {
  target_titles: [
    "VP of Engineering", "VP Engineering", "Vice President of Engineering",
    "CTO", "Chief Technology Officer",
    "CFO", "Chief Financial Officer",
    "CEO", "Chief Executive Officer",
  ],
  employee_ranges: ["501,1000", "1001,2000", "2001,5000", "5001,10000"],
  locations: ["United States"],
  keywords: ["SaaS", "software", "cloud", "platform"],
  seniorities: ["vp", "c_suite"],
};

export const NAMED_ACCOUNTS: NamedAccount[] = [
  { name: "Rippling", domain: "rippling.com", segment: "modern_tech" },
  { name: "Coupang", domain: "coupang.com", segment: "modern_tech" },
  { name: "Workday", domain: "workday.com", segment: "modern_tech" },
  { name: "Datadog", domain: "datadoghq.com", segment: "modern_tech" },
  { name: "Figma", domain: "figma.com", segment: "modern_tech" },
  { name: "Notion", domain: "notion.so", segment: "modern_tech" },
  { name: "Gusto", domain: "gusto.com", segment: "modern_tech" },
  { name: "Plaid", domain: "plaid.com", segment: "modern_tech" },
  { name: "Brex", domain: "brex.com", segment: "modern_tech" },
  { name: "Ramp", domain: "ramp.com", segment: "modern_tech" },
  { name: "Scale AI", domain: "scale.com", segment: "modern_tech" },
  { name: "Anduril", domain: "anduril.com", segment: "modern_tech" },
  { name: "Johnson Controls", domain: "johnsoncontrols.com", segment: "hybrid_tech" },
  { name: "Medtronic", domain: "medtronic.com", segment: "hybrid_tech" },
  { name: "Bosch", domain: "bosch.com", segment: "hybrid_tech" },
  { name: "Honeywell", domain: "honeywell.com", segment: "hybrid_tech" },
  { name: "Siemens", domain: "siemens.com", segment: "hybrid_tech" },
  { name: "Rockwell Automation", domain: "rockwellautomation.com", segment: "hybrid_tech" },
  { name: "Carrier", domain: "carrier.com", segment: "hybrid_tech" },
  { name: "Eaton", domain: "eaton.com", segment: "hybrid_tech" },
  { name: "Emerson", domain: "emerson.com", segment: "hybrid_tech" },
  { name: "Parker Hannifin", domain: "parker.com", segment: "hybrid_tech" },
  { name: "Trane Technologies", domain: "tranetechnologies.com", segment: "hybrid_tech" },
  { name: "John Deere", domain: "deere.com", segment: "hybrid_tech" },
  { name: "Trimble", domain: "trimble.com", segment: "hybrid_tech" },
  { name: "Google", domain: "google.com", segment: "one_of_a_kind" },
  { name: "Microsoft", domain: "microsoft.com", segment: "one_of_a_kind" },
  { name: "Amazon", domain: "amazon.com", segment: "one_of_a_kind" },
  { name: "OpenAI", domain: "openai.com", segment: "one_of_a_kind" },
  { name: "Anthropic", domain: "anthropic.com", segment: "one_of_a_kind" },
  { name: "Guidewire", domain: "guidewire.com", segment: "traditional_tech" },
  { name: "Planview", domain: "planview.com", segment: "traditional_tech" },
  { name: "Anaplan", domain: "anaplan.com", segment: "traditional_tech" },
  { name: "Tibco", domain: "tibco.com", segment: "traditional_tech" },
];

export const SCORING = {
  firmographic: {
    engineer_count: { "1000-5000": 10, "500-999": 7, "200-499": 4, "100-199": 1 },
    segment: { modern_tech: 10, hybrid_tech: 8, one_of_a_kind: 6, traditional_tech: 4 } as Record<string, number>,
    revenue_band: { "100M-1B": 10, "50M-100M": 7, "20M-50M": 4, "10M-20M": 1 },
    funding_stage: { series_c_plus: 10, series_b: 7, series_a: 4, seed: 1, public: 10 },
  },
  technographic: {
    security_tooling: { snyk_and_veracode: 10, snyk_or_veracode: 7, basic_sast: 4, none_detected: 0 },
    cicd_maturity: { github_actions_k8s: 10, github_actions_docker: 7, basic_ci: 4, none_detected: 0 },
    ai_adoption: { copilot_cursor_claude: 10, evaluating: 7, none_detected: 0 },
  },
  intent: {
    hiring_security: { vp_security_hired: 10, security_engineer_posting: 7, devops_posting: 4, none: 0 },
    funding_growth: { raised_50m_plus: 10, raised_10_50m: 7, headcount_growth_20pct: 4, none: 0 },
    leadership_change: { new_cto_vp_eng: 10, new_ciso: 7, eng_reorg: 4, none: 0 },
  },
};

export const TIERS = { tier_1_hot: 75, tier_2_warm: 50, tier_3_nurture: 25 };

export interface Persona {
  titles: string[];
  pain_points: string[];
  value_hook: string;
  linkedin_template: string;
  email_subject_templates: string[];
  email_body_template: string;
  cta: string;
}

export const PERSONAS: Record<PersonaKey, Persona> = {
  vp_engineering: {
    titles: ["VP of Engineering", "VP Engineering", "Vice President of Engineering", "SVP Engineering", "Head of Engineering"],
    pain_points: [
      "Security gates blocking release velocity",
      "SAST/DAST alert fatigue drowning developers",
      "False positives wasting engineering cycles",
    ],
    value_hook: "Reduce MTTR from 84 days to <10 min with deterministic, auto-generated fixes that preserve developer intent",
    linkedin_template:
      "Hey {first_name}, saw {company} is {signal_description} — curious if remediation velocity is top of mind? We're helping teams like {peer_company} cut MTTR from weeks to minutes.",
    email_subject_templates: [
      "How {peer_company} cut security MTTR by 95%",
      "{company}'s remediation bottleneck has a fix",
      "Saw {company} is {signal_short} — quick thought",
    ],
    email_body_template:
      "Hi {first_name},\n\nNoticed {company} just {signal_description}.\n\nWhen engineering teams scale, security bottlenecks tend to emerge — especially with AI-generated code now making up 30%+ of new commits.\n\nWe built UnitOne to fix this: deterministic security remediation that generates verified patches in minutes, not weeks. Think GitOps for security posture — every repo carries enforceable security contracts.\n\n{peer_company} went from 84-day MTTR to <10 minutes. Happy to show you how in 15 min.\n\nWorth a quick look?\n\nBest,\n{sender_name}",
    cta: "15-min demo showing deterministic fix generation on a live CVE",
  },
  cto: {
    titles: ["CTO", "Chief Technology Officer", "CTO and VP Engineering"],
    pain_points: [
      "AI-assisted code introduces new vulnerability classes at scale",
      "Centralized security can't keep up with decentralized dev teams",
      "Compliance risk grows with agentic development",
    ],
    value_hook: "Security State Layer that embeds enforceable security contracts into every repo",
    linkedin_template:
      "Hi {first_name}, congrats on the {signal_description} at {company}. With agentic coding tools scaling, I'm seeing CTOs rethink how security fits into the SDLC. Worth comparing notes?",
    email_subject_templates: [
      "{company}'s security posture in an AI-first world",
      "The security model that breaks with agentic code",
      "{first_name} — deterministic remediation for {company}",
    ],
    email_body_template:
      "Hi {first_name},\n\nWith AI agents now generating code at scale, the security model that worked for human-authored code is breaking down. 28% of CVEs are exploited within 24 hours of disclosure, but enterprise fix times average 84 days.\n\nUnitOne is building the Security State Layer for agentic development — persistent memory + intent graphs that let every repo carry enforceable security contracts. Fixes are deterministic, verified, and deployed in minutes.\n\nWe're already working with {peer_company}. Would love 15 minutes to show you the approach.\n\nBest,\n{sender_name}",
    cta: "Architecture walkthrough — how Security State Layer integrates with your stack",
  },
  cfo: {
    titles: ["CFO", "Chief Financial Officer", "VP Finance"],
    pain_points: [
      "Security incidents cost $2-4M+ per breach",
      "Remediation labor costs rising",
      "Compliance audit failures delay revenue recognition",
    ],
    value_hook: "Reduce remediation cost by 60%+; continuous compliance posture for auditors and insurers",
    linkedin_template:
      "Hi {first_name}, noticed {company} is {signal_description} — security remediation costs tend to spike at your stage. We're helping CFOs at {peer_company} cut that by 60%.",
    email_subject_templates: [
      "Cutting security remediation costs by 60% at {company}",
      "The hidden P&L line item at {company}",
      "{first_name} — remediation ROI model for {company}",
    ],
    email_body_template:
      "Hi {first_name},\n\nAs {company} scales, security remediation becomes a major line item — the average critical vulnerability costs $2-4M to fix post-deployment, and audit prep alone can consume weeks of engineering time.\n\nUnitOne automates security remediation with deterministic, verified fixes — reducing MTTR from months to minutes. For CFOs, this means: lower remediation labor costs, continuous compliance posture (SOC2/ISO), and reduced cyber insurance premiums.\n\n{peer_company} reduced their security remediation spend by 60% in the first quarter.\n\nWorth a 15-minute conversation about the ROI model?\n\nBest,\n{sender_name}",
    cta: "ROI calculator walkthrough — remediation cost reduction model",
  },
  ceo: {
    titles: ["CEO", "Chief Executive Officer", "Co-Founder & CEO", "Founder & CEO"],
    pain_points: [
      "Security incidents damage brand and customer trust",
      "Release delays hurt competitive positioning",
      "Board pressure on security posture",
    ],
    value_hook: "Turn security from a cost center into a competitive advantage",
    linkedin_template:
      "Hi {first_name}, {company} is clearly on a growth trajectory. We're working with CEOs who want to turn security from a blocker into a differentiator — 15 min to share how?",
    email_subject_templates: [
      "Making security a competitive moat at {company}",
      "{company}'s next board meeting — a security story worth telling",
      "{first_name} — security as differentiator at {company}",
    ],
    email_body_template:
      "Hi {first_name},\n\nYour engineering team is scaling fast — which is great for velocity, but creates a security coordination challenge that most CEOs don't see until it becomes a customer-facing incident.\n\nUnitOne turns security into a competitive advantage: deterministic remediation in minutes (not months), continuous compliance, and the ability to tell customers and your board that every line of code is provably secure.\n\nWe're working with {peer_company} on this exact challenge. Happy to share what we're seeing across the market.\n\nWorth a quick conversation?\n\nBest,\n{sender_name}",
    cta: "Executive briefing — market trends in agentic security",
  },
};

export const PEER_REFERENCES: Record<Segment, string> = {
  modern_tech: "leading cloud-native companies",
  hybrid_tech: "enterprise hardware+software leaders",
  one_of_a_kind: "hyperscale engineering organizations",
  traditional_tech: "established enterprise software companies",
};

export const SENDER = {
  name: "Kamal Srinivasan",
  title: "Co-Founder & CEO",
  company: "UnitOne",
  email: "kamal@unitone.ai",
  linkedin: "https://www.linkedin.com/in/kamalsrinivasan/",
};

export const GITHUB_KEYWORDS = [
  "security", "vulnerability", "CVE", "remediation",
  "SAST", "DAST", "dependency scanning", "supply chain",
  "devsecops", "appsec", "sbom",
];

export const GITHUB_ORG_MAP: Record<string, string> = {
  Rippling: "rippling", Datadog: "DataDog", Figma: "figma", Notion: "makenotion",
  Gusto: "Gusto", Plaid: "plaid", Brex: "brexhq", "Scale AI": "scaleapi",
  Anduril: "anduril", Workday: "Workday", Honeywell: "nicehoneywell",
};

export const ENGAGEMENT_ASSETS: Record<PersonaKey, { asset_type: string; description: string; asset_url_template: string }> = {
  vp_engineering: {
    asset_type: "Interactive Demo",
    description: "Live CVE remediation simulation — 4-step animated terminal walkthrough",
    asset_url_template: "https://unitone.ai/demo?company={slug}",
  },
  cto: {
    asset_type: "Security Posture Teardown",
    description: "Personalized exposure gap analysis + tech stack teardown",
    asset_url_template: "https://unitone.ai/teardown/{slug}",
  },
  cfo: {
    asset_type: "ROI One-Pager",
    description: "Cost-of-inaction calculator + remediation savings model",
    asset_url_template: "https://unitone.ai/roi/{slug}",
  },
  ceo: {
    asset_type: "Executive Briefing",
    description: "Market trends in agentic security + competitive positioning",
    asset_url_template: "https://unitone.ai/brief/{slug}",
  },
};

export const TIER_LABELS = {
  HOT: "TIER 1 — HOT",
  WARM: "TIER 2 — WARM",
  NURTURE: "TIER 3 — NURTURE",
  WATCH: "TIER 4 — WATCH",
} as const;

export function tierAction(tier: string): string {
  const actions: Record<string, string> = {
    [TIER_LABELS.HOT]: "Founder-led outreach + multi-channel sequence TODAY",
    [TIER_LABELS.WARM]: "Automated sequence + LinkedIn warm-up within 48 hours",
    [TIER_LABELS.NURTURE]: "Add to nurture sequence, monitor for signal escalation",
    [TIER_LABELS.WATCH]: "Monitor only — wait for buying signal before outreach",
  };
  return actions[tier] ?? "Review manually";
}
