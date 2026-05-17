"use client";

import { useState, useTransition } from "react";
import type { PatternEntry } from "@/lib/vault/patterns";

export function PatternsPanel({ initial }: { initial: PatternEntry[] }) {
  const [patterns, setPatterns] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function scan() {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/vault/patterns?days=30");
      const data = (await res.json()) as { patterns?: PatternEntry[]; error?: string };
      if (data.patterns) {
        setPatterns(data.patterns);
        setMsg(`Found ${data.patterns.length} recurring pattern${data.patterns.length !== 1 ? "s" : ""}`);
      } else {
        setMsg(data.error ?? "Scan failed");
      }
    });
  }

  const maxCount = Math.max(...patterns.map((p) => p.dayCount), 1);

  return (
    <div className="terminal-panel bg-[#121411] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="terminal-label text-[#f4f1e8]">Patterns</span>
          <span className="text-[0.55rem] uppercase tracking-[0.14em] text-[#6f6a61]">30-day daily notes</span>
        </div>
        <button
          type="button"
          onClick={scan}
          disabled={isPending}
          className="text-[0.6rem] uppercase tracking-[0.14em] text-[#6f6a61] transition hover:text-[#e86f3a] disabled:opacity-50"
        >
          {isPending ? "Scanning…" : "Spot patterns"}
        </button>
      </div>

      {msg ? <div className="mb-2 text-[0.62rem] text-[#a8a29a]">{msg}</div> : null}

      {patterns.length === 0 ? (
        <div className="text-[0.7rem] text-[#6f6a61]">
          No patterns yet. Click &ldquo;Spot patterns&rdquo; after writing a few daily notes.
        </div>
      ) : (
        <div className="space-y-[5px]">
          {patterns.slice(0, 12).map((p) => {
            const barPct = Math.max(6, Math.round((p.dayCount / maxCount) * 100));
            return (
              <div key={p.term} className="grid grid-cols-[90px_1fr_32px] items-center gap-2">
                <span className="truncate text-[0.7rem] font-bold text-[#f4f1e8]">{p.term}</span>
                <div className="h-[6px] overflow-hidden rounded-[2px] bg-[#1a1c18]">
                  <div
                    className="h-full rounded-[2px] bg-[#e86f3a]/70"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className="text-right text-[0.6rem] text-[#8b857b]">{p.dayCount}d</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
