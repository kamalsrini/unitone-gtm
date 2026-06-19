/**
 * UnitOne GTM Engine — Layer 2 Apollo integration (ported from apollo_*.py)
 * Search people, enrich (reveal email), and add to an Apollo sequence.
 * Live calls to api.apollo.io. Requires APOLLO_API_KEY.
 */
import { ICP } from "./config";

const APOLLO_BASE = "https://api.apollo.io/api/v1";

function headers() {
  const key = process.env.APOLLO_API_KEY || "";
  return { "Content-Type": "application/json", "Cache-Control": "no-cache", "X-Api-Key": key };
}

export function apolloConfigured(): boolean {
  return !!process.env.APOLLO_API_KEY;
}

export interface ApolloPerson {
  apollo_id: string;
  name: string;
  title: string;
  company: string;
  domain: string;
  linkedin_url?: string;
  email?: string;
}

async function post(path: string, body: any): Promise<any> {
  const res = await fetch(`${APOLLO_BASE}${path}`, {
    method: "POST", headers: headers(), body: JSON.stringify(body), cache: "no-store",
  });
  const text = await res.text();
  let json: any = {};
  try { json = JSON.parse(text); } catch { /* non-json */ }
  if (!res.ok) throw new Error(`Apollo ${res.status}: ${json?.error ?? text.slice(0, 200)}`);
  return json;
}

/** Search people by titles + optional company domains / keyword. Email not returned here (use enrich). */
export async function searchPeople(opts: {
  titles?: string[];
  domains?: string[];
  qKeywords?: string;
  perPage?: number;
  page?: number;
}): Promise<ApolloPerson[]> {
  const body: any = {
    person_titles: opts.titles ?? ICP.target_titles,
    person_seniorities: ICP.seniorities,
    person_locations: ICP.locations,
    organization_num_employees_ranges: ICP.employee_ranges,
    page: opts.page ?? 1,
    per_page: opts.perPage ?? 25,
  };
  if (opts.domains?.length) body.q_organization_domains = opts.domains.join("\n");
  if (opts.qKeywords) body.q_keywords = opts.qKeywords;

  const data = await post("/mixed_people/search", body);
  const people: any[] = data.people ?? [];
  return people.map((p) => ({
    apollo_id: p.id,
    name: p.name ?? `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
    title: p.title ?? "",
    company: p.organization?.name ?? "",
    domain: p.organization?.primary_domain ?? p.organization?.website_url ?? "",
    linkedin_url: p.linkedin_url ?? "",
    email: p.email && !String(p.email).includes("not_unlocked") ? p.email : undefined,
  }));
}

/** Enrich a person to reveal verified email. */
export async function enrichContact(person: { apollo_id?: string; name?: string; domain?: string }): Promise<{ email?: string; raw?: any }> {
  const body: any = { reveal_personal_emails: false };
  if (person.apollo_id) body.id = person.apollo_id;
  if (person.name) body.name = person.name;
  if (person.domain) body.domain = person.domain;
  const data = await post("/people/match", body);
  const email = data?.person?.email;
  return { email: email && !String(email).includes("not_unlocked") ? email : undefined, raw: data?.person };
}

/** Add contacts to an existing Apollo sequence (emailer_campaign). Live send action — gated by caller. */
export async function addToSequence(opts: {
  sequenceId: string;
  contactIds: string[];
  sendEmailFromEmailAccountId?: string;
}): Promise<any> {
  const body: any = {
    emailer_campaign_id: opts.sequenceId,
    contact_ids: opts.contactIds,
    send_email_from_email_account_id: opts.sendEmailFromEmailAccountId,
    sequence_active_in_other_campaigns: false,
    sequence_finished_in_other_campaigns: true,
  };
  return post(`/emailer_campaigns/${opts.sequenceId}/add_contact_ids`, body);
}

/** List the user's Apollo sequences (for the create-campaign picker). */
export async function listSequences(): Promise<{ id: string; name: string }[]> {
  try {
    const data = await post("/emailer_campaigns/search", { page: 1, per_page: 100 });
    const seqs: any[] = data.emailer_campaigns ?? [];
    return seqs.map((s) => ({ id: s.id, name: s.name ?? s.id }));
  } catch {
    return [];
  }
}
