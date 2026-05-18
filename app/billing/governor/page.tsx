"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Forecast {
  daily14: Array<{ day: string; cost: number; runs: number }>;
  last7: { runs: number; cost: number; tokens: number };
  last30: { runs: number; cost: number; tokens: number };
  budgets: Array<{ id: string; window: string; maxCostUsd: number; maxRuns?: number }>;
  cache: { entries: number; hits: number; estSaved: number };
  forecast: { avgDailyCost: number; forecast30: number; forecast90: number };
}

export default function GovernorPage() {
  const [data, setData] = useState<Forecast | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/forecast", { cache: "no-store" });
    setData(await res.json());
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const clearCache = async () => {
    setBusy(true);
    await fetch("/api/billing/forecast", { method: "DELETE" });
    setBusy(false); await load();
  };

  if (!data) return <div className="p-6 text-xs text-[#6f6a61]">Loading governor…</div>;

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Cost &amp; latency</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">GOVERNOR</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Explicit per-skill model routing, prompt cache, and forward spend forecast.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="border border-[#2a302c] bg-[#080a09] p-3 text-xs">
          <div className="terminal-label">Avg/day (7d)</div>
          <div className="mt-2 text-2xl font-bold text-[#f4f1e8]">${data.forecast.avgDailyCost.toFixed(4)}</div>
        </div>
        <div className="border border-[#2a302c] bg-[#080a09] p-3 text-xs">
          <div className="terminal-label">30d forecast</div>
          <div className="mt-2 text-2xl font-bold text-[#e86f3a]">${data.forecast.forecast30.toFixed(2)}</div>
        </div>
        <div className="border border-[#2a302c] bg-[#080a09] p-3 text-xs">
          <div className="terminal-label">90d forecast</div>
          <div className="mt-2 text-2xl font-bold text-[#e86f3a]">${data.forecast.forecast90.toFixed(2)}</div>
        </div>
        <div className="border border-[#2a302c] bg-[#080a09] p-3 text-xs">
          <div className="terminal-label">30d actual</div>
          <div className="mt-2 text-2xl font-bold text-[#f4f1e8]">${data.last30.cost.toFixed(2)}</div>
          <div className="mt-1 text-[#6f6a61]">{data.last30.runs} runs</div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Prompt cache</CardTitle>
          <Badge tone="green">${data.cache.estSaved.toFixed(4)} saved</Badge>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 text-xs md:grid-cols-3">
          <div className="border border-[#2a302c] bg-[#080a09] p-3">
            <div className="terminal-label">Entries</div>
            <div className="mt-2 text-xl font-bold text-[#f4f1e8]">{data.cache.entries.toLocaleString()}</div>
          </div>
          <div className="border border-[#2a302c] bg-[#080a09] p-3">
            <div className="terminal-label">Cumulative hits</div>
            <div className="mt-2 text-xl font-bold text-[#f4f1e8]">{data.cache.hits.toLocaleString()}</div>
          </div>
          <div className="border border-[#2a302c] bg-[#080a09] p-3">
            <div className="terminal-label">Est. dollars saved</div>
            <div className="mt-2 text-xl font-bold text-[#79a875]">${data.cache.estSaved.toFixed(4)}</div>
          </div>
        </div>
        <div className="mt-3">
          <Button type="button" onClick={() => void clearCache()} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Trash2 size={11} />} Clear cache
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Per-skill routing rules</CardTitle></CardHeader>
        <ul className="space-y-1 text-xs text-[#a8a29a]">
          <li>• <strong>cheap</strong> tier → Ollama → OpenAI gpt-5.5-mini → Anthropic Haiku → Gemini flash-lite.</li>
          <li>• <strong>default</strong> tier → user-selected active profile from Settings.</li>
          <li>• <strong>premium</strong> tier → Claude Opus 4.7 → GPT-5.5 → Gemini 2.5 Pro.</li>
          <li>• Skills without an explicit <code className="text-[#e86f3a]">costTier</code> use the active Settings profile.</li>
        </ul>
      </Card>
    </div>
  );
}
