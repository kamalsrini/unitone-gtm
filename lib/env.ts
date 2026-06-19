/** Which integrations are wired (for UI badges + guardrails). */
export function integrationStatus() {
  return {
    postgres: !!(process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL),
    apollo: !!process.env.APOLLO_API_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
    slack: !!process.env.SLACK_WEBHOOK_URL,
    instantly: !!process.env.INSTANTLY_API_KEY,
    github: !!process.env.GITHUB_TOKEN,
  };
}

/** Guard cron + admin endpoints. Allows Vercel Cron (adds the secret as a bearer) or ?secret=. */
export function authorizedCron(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // unset = open (fine for first deploy / preview)
  const auth = req.headers.get("authorization") || "";
  const url = new URL(req.url);
  return auth === `Bearer ${secret}` || url.searchParams.get("secret") === secret;
}
