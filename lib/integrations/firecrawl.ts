/**
 * Firecrawl client — single-page scrape + multi-page crawl.
 * Docs: https://docs.firecrawl.dev
 *
 * Used by the Firecrawl Scrape and Deep Research skills. Reads only — no
 * external mutations. Output is written to the local vault by the caller.
 */

export interface FirecrawlScrapeResult {
  url: string;
  markdown: string;
  title?: string;
  description?: string;
  sourceURL?: string;
}

export interface FirecrawlCrawlPage {
  url: string;
  markdown: string;
  title?: string;
}

export interface FirecrawlCrawlResult {
  startUrl: string;
  pageCount: number;
  pages: FirecrawlCrawlPage[];
}

const BASE = "https://api.firecrawl.dev";

function authHeaders(): HeadersInit | null {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  return { Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}

export function isFirecrawlConfigured(): boolean {
  return Boolean(process.env.FIRECRAWL_API_KEY);
}

export async function scrapeUrl(url: string): Promise<FirecrawlScrapeResult> {
  const headers = authHeaders();
  if (!headers) throw new Error("FIRECRAWL_API_KEY not set");
  const res = await fetch(`${BASE}/v1/scrape`, {
    method: "POST",
    headers,
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`Firecrawl scrape failed (${res.status})`);
  const json = (await res.json()) as {
    success?: boolean;
    data?: {
      markdown?: string;
      metadata?: { title?: string; description?: string; sourceURL?: string };
    };
    error?: string;
  };
  if (json.success === false) throw new Error(json.error ?? "Firecrawl scrape returned success=false");
  return {
    url,
    markdown: json.data?.markdown ?? "",
    title: json.data?.metadata?.title,
    description: json.data?.metadata?.description,
    sourceURL: json.data?.metadata?.sourceURL,
  };
}

export async function startCrawl(
  url: string,
  options: { limit?: number; maxDepth?: number; includePaths?: string[] } = {},
): Promise<string> {
  const headers = authHeaders();
  if (!headers) throw new Error("FIRECRAWL_API_KEY not set");
  const res = await fetch(`${BASE}/v1/crawl`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      url,
      limit: options.limit ?? 25,
      maxDepth: options.maxDepth ?? 3,
      includePaths: options.includePaths,
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Firecrawl crawl start failed (${res.status})`);
  const json = (await res.json()) as { success?: boolean; id?: string; error?: string };
  if (!json.id) throw new Error(json.error ?? "Firecrawl did not return a job id");
  return json.id;
}

export interface CrawlStatusResponse {
  status: "scraping" | "completed" | "failed" | string;
  completed: number;
  total: number;
  data?: Array<{
    markdown?: string;
    metadata?: { title?: string; sourceURL?: string };
  }>;
  next?: string | null;
}

export async function getCrawlStatus(jobId: string): Promise<CrawlStatusResponse> {
  const headers = authHeaders();
  if (!headers) throw new Error("FIRECRAWL_API_KEY not set");
  const res = await fetch(`${BASE}/v1/crawl/${encodeURIComponent(jobId)}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Firecrawl status failed (${res.status})`);
  return (await res.json()) as CrawlStatusResponse;
}

export async function crawlAndWait(
  url: string,
  options: { limit?: number; maxDepth?: number; pollMs?: number; maxWaitMs?: number } = {},
): Promise<FirecrawlCrawlResult> {
  const jobId = await startCrawl(url, options);
  const pollMs = options.pollMs ?? 3000;
  const maxWaitMs = options.maxWaitMs ?? 240_000;
  const startedAt = Date.now();

  while (true) {
    const status = await getCrawlStatus(jobId);
    if (status.status === "completed") {
      const pages: FirecrawlCrawlPage[] = (status.data ?? []).map((d) => ({
        url: d.metadata?.sourceURL ?? "",
        markdown: d.markdown ?? "",
        title: d.metadata?.title,
      }));
      return { startUrl: url, pageCount: pages.length, pages };
    }
    if (status.status === "failed") {
      throw new Error(`Firecrawl crawl ${jobId} failed`);
    }
    if (Date.now() - startedAt > maxWaitMs) {
      throw new Error(`Firecrawl crawl ${jobId} timed out after ${maxWaitMs}ms`);
    }
    await new Promise((r) => setTimeout(r, pollMs));
  }
}
