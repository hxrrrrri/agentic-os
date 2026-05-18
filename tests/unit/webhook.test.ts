import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("notify/webhook", () => {
  const fetchSpy = vi.fn();
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchSpy.mockReset();
    fetchSpy.mockResolvedValue(new Response("ok", { status: 200 }));
    globalThis.fetch = fetchSpy as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.SLACK_WEBHOOK_URL;
    delete process.env.DISCORD_WEBHOOK_URL;
    delete process.env.AGENTICOS_WEBHOOK_URL;
  });

  it("no-op when no webhook env var is set", async () => {
    const { sendWebhookEvent } = await import("@/lib/notify/webhook");
    await sendWebhookEvent({ title: "hello", message: "world" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts to Slack when configured", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T/B/X";
    const { sendWebhookEvent } = await import("@/lib/notify/webhook");
    await sendWebhookEvent({ title: "Run done", message: "All steps complete", level: "info", runId: "r1" });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toContain("hooks.slack.com");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.text).toContain("Run done");
  });

  it("posts to Discord and Slack when both are configured", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/A";
    process.env.DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/123/abc";
    const { sendWebhookEvent } = await import("@/lib/notify/webhook");
    await sendWebhookEvent({ title: "X", message: "Y" });
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
