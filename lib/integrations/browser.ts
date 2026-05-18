/**
 * Browser interaction adapter, backed by Firecrawl /interact.
 *
 * Firecrawl already runs a managed Chromium for /scrape and /crawl. The
 * /v1/interact endpoint accepts a list of step actions (click, type, wait,
 * scroll, screenshot, scrape) and returns the resulting markdown / HTML +
 * screenshot URLs. We expose a thin wrapper so the agent and skills can
 * drive a real browser without us hosting Playwright.
 *
 * Requires FIRECRAWL_API_KEY. Reads-only style — every action is described in
 * the steps payload, no shell exec, no local browser dependency.
 */

import { getSecret } from "@/lib/secrets/store";

const BASE = "https://api.firecrawl.dev/v1";

export interface InteractAction {
  type: "click" | "type" | "wait" | "screenshot" | "scroll" | "scrape" | "navigate";
  selector?: string;
  text?: string;
  url?: string;
  milliseconds?: number;
  pixels?: number;
}

export interface InteractResult {
  ok: boolean;
  data?: {
    markdown?: string;
    html?: string;
    screenshot?: string;
    metadata?: Record<string, unknown>;
  };
  warning?: string;
  error?: string;
}

export async function runInteract(url: string, steps: InteractAction[]): Promise<InteractResult> {
  const key = await getSecret("FIRECRAWL_API_KEY");
  if (!key) throw new Error("FIRECRAWL_API_KEY not set");

  const res = await fetch(`${BASE}/interact`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      steps,
      formats: ["markdown", "screenshot"],
    }),
    signal: AbortSignal.timeout(120_000),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, error: `Firecrawl interact ${res.status}: ${body.slice(0, 300)}` };
  }
  const json = (await res.json()) as InteractResult;
  return json;
}
