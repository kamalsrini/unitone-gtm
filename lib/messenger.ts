/**
 * UnitOne GTM Engine — Layer 3 Message Generator (ported from gtm_engine/messenger.py)
 * Persona-aware outreach copy. Template-based (no AI credits required).
 */
import { PERSONAS, PEER_REFERENCES, SENDER, ENGAGEMENT_ASSETS, PersonaKey, Segment } from "./config";
import { ScoredAccount, SignalRow } from "./scorer";

export interface GeneratedMessage {
  company: string;
  domain: string;
  persona: PersonaKey;
  contact_name: string;
  contact_title: string;
  tier: string;
  linkedin: string;
  subject: string;
  body: string;
  asset_type: string;
  asset_url: string;
  cta: string;
}

export function classifyPersona(title: string): PersonaKey | null {
  const t = (title || "").toLowerCase();
  for (const key of Object.keys(PERSONAS) as PersonaKey[]) {
    for (const pt of PERSONAS[key].titles) {
      if (t.includes(pt.toLowerCase())) return key;
    }
  }
  return null;
}

function buildSignalDescription(signals: SignalRow[], company: string): { long: string; short: string } {
  const acct = signals.filter((s) => s.company?.toLowerCase() === company.toLowerCase());
  if (!acct.length) return { long: "scaling its engineering org", short: "scaling fast" };
  const strong = acct.find((s) => s.signal_strength === "HIGH") ?? acct[0];
  const map: Record<string, [string, string]> = {
    github_security_activity: ["ramping up security engineering work", "shipping security work"],
    github_security_issues: ["actively triaging security issues", "triaging security issues"],
    hn_discussion: ["generating security discussion in the community", "in the security conversation"],
    funding: ["coming off a fresh raise", "freshly funded"],
    leadership: ["bringing in new engineering leadership", "reorging engineering"],
  };
  const key = Object.keys(map).find((k) => (strong.signal_type ?? "").includes(k));
  return key ? { long: map[key][0], short: map[key][1] } : { long: "scaling its engineering org", short: "scaling fast" };
}

function fill(tpl: string, vars: Record<string, string>): string {
  return tpl.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? `{${k}}`);
}

function slug(domain: string): string {
  return domain.replace(/\.(com|so|ai|io|net)$/, "").replace(/[^a-z0-9]/gi, "-").toLowerCase();
}

export interface ContactInput {
  name?: string;
  title?: string;
}

export function generateMessage(
  account: ScoredAccount,
  signals: SignalRow[] = [],
  personaKey?: PersonaKey,
  contact?: ContactInput
): GeneratedMessage {
  const key: PersonaKey = personaKey ?? (contact?.title ? classifyPersona(contact.title) : null) ?? "vp_engineering";
  const persona = PERSONAS[key];
  const peer = PEER_REFERENCES[account.segment as Segment] ?? "leading engineering teams";
  const sig = buildSignalDescription(signals, account.name);
  const firstName = (contact?.name || "there").split(" ")[0];

  const vars: Record<string, string> = {
    first_name: firstName,
    company: account.name,
    peer_company: peer,
    signal_description: sig.long,
    signal_short: sig.short,
    sender_name: SENDER.name,
  };

  const asset = ENGAGEMENT_ASSETS[key];
  const subjects = persona.email_subject_templates;
  const subject = fill(subjects[Math.floor(Math.random() * subjects.length)], vars);

  return {
    company: account.name,
    domain: account.domain,
    persona: key,
    contact_name: contact?.name ?? "",
    contact_title: contact?.title ?? "",
    tier: account.tier,
    linkedin: fill(persona.linkedin_template, vars),
    subject,
    body: fill(persona.email_body_template, vars),
    asset_type: asset.asset_type,
    asset_url: asset.asset_url_template.replace("{slug}", slug(account.domain)),
    cta: persona.cta,
  };
}

/** Generate messages for scored accounts. If contacts present, one per contact; else one per default persona. */
export function generateAllMessages(
  scored: ScoredAccount[],
  signals: SignalRow[] = [],
  contactsByDomain: Record<string, ContactInput[]> = {}
): GeneratedMessage[] {
  const out: GeneratedMessage[] = [];
  for (const acct of scored) {
    const contacts = contactsByDomain[acct.domain] ?? [];
    if (contacts.length) {
      for (const c of contacts) {
        const persona = classifyPersona(c.title ?? "");
        if (persona) out.push(generateMessage(acct, signals, persona, c));
      }
    } else {
      out.push(generateMessage(acct, signals, "vp_engineering"));
    }
  }
  return out;
}
