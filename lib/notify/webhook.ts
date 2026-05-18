/**
 * Slack / Discord / generic JSON webhook notifier.
 *
 * Set one of:
 *   SLACK_WEBHOOK_URL    — posts a blocks-style message
 *   DISCORD_WEBHOOK_URL  — posts content + embed
 *   AGENTICOS_WEBHOOK_URL — generic JSON POST { title, message, level, runId }
 *
 * Failures are swallowed.
 */

export interface WebhookEvent {
  title: string;
  message: string;
  level?: "info" | "warn" | "error";
  runId?: string;
}

function colorFor(level: WebhookEvent["level"]) {
  switch (level) {
    case "error":
      return 0xe86f3a;
    case "warn":
      return 0xc99a45;
    default:
      return 0x79a875;
  }
}

async function postSlack(url: string, event: WebhookEvent) {
  const emoji = event.level === "error" ? "🚨" : event.level === "warn" ? "⚠️" : "✅";
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `${emoji} ${event.title}`,
      blocks: [
        { type: "header", text: { type: "plain_text", text: event.title } },
        { type: "section", text: { type: "mrkdwn", text: event.message } },
        event.runId
          ? {
              type: "context",
              elements: [{ type: "mrkdwn", text: `run \`${event.runId}\`` }],
            }
          : null,
      ].filter(Boolean),
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function postDiscord(url: string, event: WebhookEvent) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: event.title,
      embeds: [
        {
          title: event.title,
          description: event.message,
          color: colorFor(event.level),
          footer: event.runId ? { text: `run ${event.runId}` } : undefined,
          timestamp: new Date().toISOString(),
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });
}

async function postGeneric(url: string, event: WebhookEvent) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(5000),
  });
}

export async function sendWebhookEvent(event: WebhookEvent): Promise<void> {
  const slack = process.env.SLACK_WEBHOOK_URL;
  const discord = process.env.DISCORD_WEBHOOK_URL;
  const generic = process.env.AGENTICOS_WEBHOOK_URL;
  const jobs: Promise<unknown>[] = [];
  try {
    if (slack) jobs.push(postSlack(slack, event));
    if (discord) jobs.push(postDiscord(discord, event));
    if (generic) jobs.push(postGeneric(generic, event));
    await Promise.allSettled(jobs);
  } catch {
    // silent
  }
}

export function isWebhookConfigured(): boolean {
  return Boolean(
    process.env.SLACK_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || process.env.AGENTICOS_WEBHOOK_URL,
  );
}
