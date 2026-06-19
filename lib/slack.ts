/**
 * UnitOne GTM Engine — Layer 4 Slack alerts (ported from Slack webhook usage).
 */
export async function slackNotify(text: string, blocks?: any[]): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function campaignSummaryBlocks(campaign: string, stats: Record<string, number>): any[] {
  return [
    { type: "header", text: { type: "plain_text", text: `🚀 UnitOne GTM — ${campaign}` } },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*Signals:* ${stats.signals ?? 0}   *Scored:* ${stats.scored ?? 0}   *HOT:* ${stats.hot ?? 0}\n` +
          `*Messages:* ${stats.messages ?? 0}   *Enrolled:* ${stats.enrolled ?? 0}   *Replies:* ${stats.replies ?? 0}`,
      },
    },
  ];
}
