import { NextResponse } from "next/server";
import { z } from "zod";
import { scrapeUrl, crawlAndWait, isFirecrawlConfigured } from "@/lib/integrations/firecrawl";
import { writeVaultMarkdown } from "@/lib/vault/service";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ScrapeSchema = z.object({
  mode: z.literal("scrape"),
  url: z.string().url(),
  saveToVault: z.boolean().optional().default(true),
});

const CrawlSchema = z.object({
  mode: z.literal("crawl"),
  url: z.string().url(),
  limit: z.number().int().min(1).max(100).optional().default(20),
  maxDepth: z.number().int().min(1).max(5).optional().default(2),
  saveToVault: z.boolean().optional().default(true),
});

const RequestSchema = z.discriminatedUnion("mode", [ScrapeSchema, CrawlSchema]);

export async function POST(request: Request) {
  if (!await isFirecrawlConfigured()) {
    return NextResponse.json(
      { ok: false, error: "FIRECRAWL_API_KEY not set" },
      { status: 503 },
    );
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }

  try {
    if (body.mode === "scrape") {
      const result = await scrapeUrl(body.url);
      let vaultPath: string | undefined;
      if (body.saveToVault) {
        const title = result.title ?? new URL(body.url).hostname;
        vaultPath = await writeVaultMarkdown("raw", `firecrawl-${slugify(title)}`, result.markdown, {
          frontmatter: {
            tags: ["firecrawl", "scrape"],
            category: "research",
            source: body.url,
          },
        });
      }
      return NextResponse.json({ ok: true, mode: "scrape", url: body.url, vaultPath, markdownLength: result.markdown.length });
    }

    const crawl = await crawlAndWait(body.url, {
      limit: body.limit,
      maxDepth: body.maxDepth,
    });

    const vaultPaths: string[] = [];
    if (body.saveToVault) {
      const host = new URL(body.url).hostname;
      const folder = `raw/firecrawl-${slugify(host)}-${new Date().toISOString().slice(0, 10)}`;
      for (const page of crawl.pages) {
        if (!page.markdown.trim()) continue;
        const title = page.title || (page.url ? new URL(page.url).pathname : "page");
        const saved = await writeVaultMarkdown(folder, slugify(title) || "page", page.markdown, {
          frontmatter: {
            tags: ["firecrawl", "crawl"],
            category: "research",
            source: page.url || body.url,
          },
        });
        vaultPaths.push(saved);
      }
    }

    return NextResponse.json({
      ok: true,
      mode: "crawl",
      startUrl: body.url,
      pageCount: crawl.pageCount,
      savedCount: vaultPaths.length,
      vaultPaths,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Firecrawl request failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    configured: await isFirecrawlConfigured(),

    description: "POST { mode: 'scrape' | 'crawl', url, ... } to scrape a single page or crawl a domain. Results are written to the vault.",
  });
}
