/**
 * UnitOne GTM Engine — Layer 1 Signal Detection (ported from gtm_engine/signals.py)
 * Live, free public APIs: GitHub + Hacker News (Algolia). No paid SaaS.
 */
import { NamedAccount, GITHUB_KEYWORDS, GITHUB_ORG_MAP } from "./config";
import { SignalRow } from "./scorer";

const UA = { "User-Agent": "unitone-gtm/1.0" };

async function jget(url: string, headers: Record<string, string> = {}): Promise<any> {
  const res = await fetch(url, { headers: { ...UA, ...headers }, cache: "no-store" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

function domainFor(company: string, accounts: NamedAccount[]): string {
  return accounts.find((a) => a.name === company)?.domain ?? "";
}

/** GitHub: recent security-related repo activity + security-labeled issues. */
export async function checkGithubSignals(accounts: NamedAccount[], daysBack = 14): Promise<SignalRow[]> {
  const out: SignalRow[] = [];
  const token = process.env.GITHUB_TOKEN || "";
  const headers: Record<string, string> = { Accept: "application/vnd.github.v3+json" };
  if (token) headers.Authorization = `token ${token}`;
  const cutoff = new Date(Date.now() - daysBack * 864e5).toISOString();

  const entries = Object.entries(GITHUB_ORG_MAP).filter(([company]) =>
    accounts.some((a) => a.name === company)
  );

  for (const [company, org] of entries) {
    try {
      const repos: any[] = await jget(`https://api.github.com/orgs/${org}/repos?sort=updated&per_page=10`, headers);
      for (const repo of repos) {
        if ((repo.updated_at ?? "") < cutoff) continue;
        const hay = `${(repo.name ?? "").toLowerCase()} ${(repo.description ?? "").toLowerCase()} ${(repo.topics ?? []).join(" ").toLowerCase()}`;
        const matched = GITHUB_KEYWORDS.filter((kw) => hay.includes(kw.toLowerCase()));
        if (matched.length) {
          out.push({
            company, domain: domainFor(company, accounts),
            signal_type: "github_security_activity",
            signal_strength: matched.length >= 2 ? "HIGH" : "MEDIUM",
            detail: `Repo '${repo.name}' updated with security keywords: ${matched.join(", ")}`,
            url: repo.html_url ?? "", source: "github",
          });
        }
      }
      const issues = await jget(
        `https://api.github.com/search/issues?q=org:${org}+label:security+created:>${cutoff.slice(0, 10)}&sort=created&per_page=5`,
        headers
      );
      if ((issues.total_count ?? 0) > 0) {
        out.push({
          company, domain: domainFor(company, accounts),
          signal_type: "github_security_issues", signal_strength: "HIGH",
          detail: `${issues.total_count} security-labeled issues in last ${daysBack} days`,
          url: `https://github.com/${org}`, source: "github",
        });
      }
    } catch {
      /* rate limit / missing org — skip silently */
    }
  }
  return out;
}

/** Hacker News (Algolia, free) — company + security mentions. */
export async function checkHnSignals(accounts: NamedAccount[], daysBack = 14): Promise<SignalRow[]> {
  const out: SignalRow[] = [];
  const cutoff = Math.floor((Date.now() - daysBack * 864e5) / 1000);
  for (const a of accounts) {
    try {
      const q = encodeURIComponent(`"${a.name}" security`);
      const data = await jget(
        `https://hn.algolia.com/api/v1/search_by_date?query=${q}&tags=(story,comment)&numericFilters=created_at_i>${cutoff}&hitsPerPage=5`
      );
      const hits: any[] = data.hits ?? [];
      if (hits.length) {
        const top = hits[0];
        out.push({
          company: a.name, domain: a.domain,
          signal_type: "hn_discussion",
          signal_strength: hits.length >= 3 ? "HIGH" : "MEDIUM",
          detail: `${hits.length} HN mentions — e.g. "${(top.title || top.comment_text || "").slice(0, 90)}"`,
          url: top.objectID ? `https://news.ycombinator.com/item?id=${top.objectID}` : "",
          source: "hackernews",
        });
      }
    } catch {
      /* skip */
    }
  }
  return out;
}

export async function runAllSignals(accounts: NamedAccount[], daysBack = 14): Promise<SignalRow[]> {
  const [gh, hn] = await Promise.all([
    checkGithubSignals(accounts, daysBack).catch(() => []),
    checkHnSignals(accounts, daysBack).catch(() => []),
  ]);
  return [...gh, ...hn];
}
