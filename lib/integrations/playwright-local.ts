/**
 * Local Playwright browser driver — opt-in.
 *
 * Enable with AGENTICOS_LOCAL_BROWSER=1 *and* `npm i -D playwright` plus
 * `npx playwright install chromium`. When unset or when the dep isn't
 * installed, the Firecrawl-based /api/integrations/browser route remains the
 * default driver.
 *
 * Why opt-in: Playwright pulls a ~300MB Chromium runtime on first install,
 * which we never want to inflict on a casual clone of the repo.
 */

import type { InteractAction, InteractResult } from "./browser";

// We type the minimal subset of the Playwright API we touch to avoid
// importing the module statically (so absence stays graceful).
interface PwLocator {
  click(options?: { timeout?: number }): Promise<void>;
  fill(text: string, options?: { timeout?: number }): Promise<void>;
}

interface PwPage {
  goto(url: string, options?: { waitUntil?: string; timeout?: number }): Promise<unknown>;
  locator(selector: string): PwLocator;
  waitForTimeout(ms: number): Promise<void>;
  evaluate<T = unknown>(fn: string): Promise<T>;
  screenshot(options?: { fullPage?: boolean; type?: "png" | "jpeg" }): Promise<Buffer>;
  content(): Promise<string>;
  close(): Promise<void>;
}

interface PwBrowser {
  newPage(): Promise<PwPage>;
  close(): Promise<void>;
}

interface PwLaunchable {
  launch(opts?: { headless?: boolean }): Promise<PwBrowser>;
}

interface PwModule {
  chromium: PwLaunchable;
}

function loadPlaywright(): PwModule | null {
  if (process.env.AGENTICOS_LOCAL_BROWSER !== "1") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("playwright") as PwModule;
  } catch {
    return null;
  }
}

export function isLocalBrowserAvailable(): boolean {
  return loadPlaywright() !== null;
}

export async function runLocalInteract(url: string, steps: InteractAction[]): Promise<InteractResult> {
  const pw = loadPlaywright();
  if (!pw) {
    return {
      ok: false,
      error:
        "Local Playwright not available — set AGENTICOS_LOCAL_BROWSER=1 and run `npm i -D playwright && npx playwright install chromium`",
    };
  }

  const browser = await pw.chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });

    let lastScreenshotB64: string | undefined;
    for (const step of steps) {
      switch (step.type) {
        case "navigate":
          if (step.url) await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: 30_000 });
          break;
        case "click":
          if (step.selector) await page.locator(step.selector).click({ timeout: 15_000 });
          break;
        case "type":
          if (step.selector && typeof step.text === "string") {
            await page.locator(step.selector).fill(step.text, { timeout: 15_000 });
          }
          break;
        case "wait":
          await page.waitForTimeout(step.milliseconds ?? 1000);
          break;
        case "scroll":
          await page.evaluate(`window.scrollBy(0, ${Number(step.pixels ?? 500)})`);
          break;
        case "screenshot": {
          const buf = await page.screenshot({ fullPage: true });
          lastScreenshotB64 = buf.toString("base64");
          break;
        }
        case "scrape":
          // handled below: we always return current markdown-ish content at the end
          break;
      }
    }

    // Lightweight HTML→text fallback. The Firecrawl path produces real
    // markdown; users wanting that can route through that endpoint instead.
    const html = await page.content();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return {
      ok: true,
      data: {
        html,
        markdown: text,
        screenshot: lastScreenshotB64 ? `data:image/png;base64,${lastScreenshotB64}` : undefined,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Local browser run failed" };
  } finally {
    try {
      await browser.close();
    } catch {}
  }
}
