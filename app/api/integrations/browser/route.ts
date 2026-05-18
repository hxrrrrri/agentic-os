import { NextResponse } from "next/server";
import { z } from "zod";
import { runInteract } from "@/lib/integrations/browser";
import { isLocalBrowserAvailable, runLocalInteract } from "@/lib/integrations/playwright-local";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Action = z.object({
  type: z.enum(["click", "type", "wait", "screenshot", "scroll", "scrape", "navigate"]),
  selector: z.string().optional(),
  text: z.string().optional(),
  url: z.string().url().optional(),
  milliseconds: z.number().int().min(0).max(60_000).optional(),
  pixels: z.number().int().min(-100_000).max(100_000).optional(),
});

const Schema = z.object({
  url: z.string().url(),
  steps: z.array(Action).min(1).max(20),
  driver: z.enum(["firecrawl", "local", "auto"]).optional().default("auto"),
});

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const driver =
      body.driver === "local"
        ? "local"
        : body.driver === "firecrawl"
          ? "firecrawl"
          : isLocalBrowserAvailable()
            ? "local"
            : "firecrawl";
    const result =
      driver === "local"
        ? await runLocalInteract(body.url, body.steps)
        : await runInteract(body.url, body.steps);
    return NextResponse.json({ ...result, driver });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
