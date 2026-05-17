/**
 * Lightweight push notifier.
 *
 * Supports ntfy (https://ntfy.sh) — set NTFY_TOPIC (e.g. https://ntfy.sh/my-secret-topic)
 * and optional NTFY_TOKEN to receive notifications on phone + desktop.
 *
 * Failures are swallowed — notification is best-effort.
 */

interface PushOptions {
  title: string;
  message: string;
  priority?: "low" | "default" | "high" | "urgent";
  tags?: string[];
  click?: string;
}

export function isPushConfigured(): boolean {
  return Boolean(process.env.NTFY_TOPIC);
}

export async function pushNotification(opts: PushOptions): Promise<boolean> {
  const topic = process.env.NTFY_TOPIC;
  if (!topic) return false;

  const headers: Record<string, string> = {
    Title: opts.title,
  };
  if (opts.priority) headers.Priority = opts.priority;
  if (opts.tags?.length) headers.Tags = opts.tags.join(",");
  if (opts.click) headers.Click = opts.click;
  if (process.env.NTFY_TOKEN) headers.Authorization = `Bearer ${process.env.NTFY_TOKEN}`;

  try {
    await fetch(topic, {
      method: "POST",
      body: opts.message,
      headers,
      signal: AbortSignal.timeout(5000),
    });
    return true;
  } catch {
    return false;
  }
}
