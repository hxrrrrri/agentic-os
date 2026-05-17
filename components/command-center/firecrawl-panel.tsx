"use client";

import { useState } from "react";
import { Globe, Layers, Loader2 } from "lucide-react";

interface RunResult {
  ok: boolean;
  mode?: string;
  url?: string;
  startUrl?: string;
  pageCount?: number;
  savedCount?: number;
  vaultPath?: string;
  vaultPaths?: string[];
  markdownLength?: number;
  error?: string;
}

export function FirecrawlPanel() {
  const [url, setUrl] = useState("");
  const [mode, setMode] = useState<"scrape" | "crawl">("scrape");
  const [limit, setLimit] = useState(15);
  const [maxDepth, setMaxDepth] = useState(2);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);

  const submit = async () => {
    if (!url) return;
    setPending(true);
    setResult(null);
    try {
      const body =
        mode === "scrape"
          ? { mode, url, saveToVault: true }
          : { mode, url, limit, maxDepth, saveToVault: true };
      const res = await fetch("/api/integrations/firecrawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setResult((await res.json()) as RunResult);
    } catch (err) {
      setResult({ ok: false, error: err instanceof Error ? err.message : "Request failed" });
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="mb-3 flex items-center gap-2">
        <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">$ Firecrawl</span>
        <span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#6f6a61]">
          scrape or deep-crawl into vault/raw
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
        <label className="block text-[0.62rem] uppercase tracking-[0.16em] text-[#a8a29a]">
          <span className="block">URL</span>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com"
            className="mt-1 w-full rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-[6px] text-[0.72rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
          />
        </label>

        <label className="block text-[0.62rem] uppercase tracking-[0.16em] text-[#a8a29a]">
          <span className="block">Mode</span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "scrape" | "crawl")}
            className="mt-1 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-[6px] text-[0.72rem] text-[#f4f1e8] focus:border-[#e86f3a]"
          >
            <option value="scrape">scrape (1 page)</option>
            <option value="crawl">crawl (many pages)</option>
          </select>
        </label>

        {mode === "crawl" ? (
          <>
            <label className="block text-[0.62rem] uppercase tracking-[0.16em] text-[#a8a29a]">
              <span className="block">Limit</span>
              <input
                type="number"
                value={limit}
                min={1}
                max={100}
                onChange={(e) => setLimit(parseInt(e.target.value, 10) || 1)}
                className="mt-1 w-16 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-[6px] text-[0.72rem] text-[#f4f1e8] focus:border-[#e86f3a]"
              />
            </label>
            <label className="block text-[0.62rem] uppercase tracking-[0.16em] text-[#a8a29a]">
              <span className="block">Depth</span>
              <input
                type="number"
                value={maxDepth}
                min={1}
                max={5}
                onChange={(e) => setMaxDepth(parseInt(e.target.value, 10) || 1)}
                className="mt-1 w-16 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-[6px] text-[0.72rem] text-[#f4f1e8] focus:border-[#e86f3a]"
              />
            </label>
          </>
        ) : null}
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={pending || !url}
        className="mt-3 inline-flex h-7 items-center gap-2 rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] px-3 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] transition hover:bg-[#251914] disabled:opacity-50"
      >
        {pending ? <Loader2 size={11} className="animate-spin" /> : mode === "scrape" ? <Globe size={11} /> : <Layers size={11} />}
        {pending ? "Running" : mode === "scrape" ? "Scrape" : "Crawl"}
      </button>

      {result ? (
        <div
          className={`mt-3 rounded-[2px] border px-3 py-2 text-[0.7rem] ${
            result.ok
              ? "border-[#79a875]/40 bg-[#79a875]/5 text-[#9fc39b]"
              : "border-[#5a1818]/40 bg-[#1a1010] text-[#e86f3a]"
          }`}
        >
          {result.ok ? (
            result.mode === "scrape" ? (
              <>
                Scraped {result.markdownLength?.toLocaleString()} chars from <span className="text-[#f4f1e8]">{result.url}</span>
                {result.vaultPath ? <> → <span className="text-[#f4f1e8]">vault/{result.vaultPath}</span></> : null}
              </>
            ) : (
              <>
                Crawled {result.pageCount} pages from <span className="text-[#f4f1e8]">{result.startUrl}</span>, saved {result.savedCount} into vault.
                {result.vaultPaths?.length ? (
                  <ul className="mt-2 list-disc pl-4 text-[0.68rem] text-[#a8a29a]">
                    {result.vaultPaths.slice(0, 8).map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                    {result.vaultPaths.length > 8 ? <li>… {result.vaultPaths.length - 8} more</li> : null}
                  </ul>
                ) : null}
              </>
            )
          ) : (
            <>Error: {result.error}</>
          )}
        </div>
      ) : null}
    </div>
  );
}
