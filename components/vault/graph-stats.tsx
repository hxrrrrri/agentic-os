"use client";

import { useTransition, useState } from "react";
import type { GraphStats } from "@/lib/db/repositories";

export function GraphStatsCard({ stats: initial }: { stats: GraphStats }) {
  const [stats, setStats] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function reindex() {
    setMsg(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/vault/graph", { method: "POST" });
        const data = (await res.json()) as { nodes?: number; links?: number; error?: string };
        if (data.error) { setMsg(`Error: ${data.error}`); return; }
        setMsg(`Indexed ${data.nodes ?? 0} notes, ${data.links ?? 0} links`);
        // refresh stats
        const statsRes = await fetch("/api/vault/graph?action=stats");
        const fresh = (await statsRes.json()) as GraphStats;
        setStats(fresh);
      } catch {
        setMsg("Index failed — check console");
      }
    });
  }

  const items = [
    { label: "Notes indexed", value: stats.nodeCount },
    { label: "Wikilinks", value: stats.linkCount },
    { label: "Orphan notes", value: stats.orphanCount },
  ];

  return (
    <div className="terminal-panel bg-[#121411] px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between">
        <div className="terminal-label text-[#f4f1e8]">Graph Index</div>
        <button
          type="button"
          onClick={reindex}
          disabled={isPending}
          className="text-[0.6rem] uppercase tracking-[0.14em] text-[#6f6a61] transition hover:text-[#e86f3a] disabled:opacity-50 disabled:cursor-wait"
        >
          {isPending ? "Indexing…" : "Re-index"}
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {items.map((item) => (
          <div key={item.label} className="border border-[#2a302c] bg-[#080a09] px-1.5 py-1 text-center">
            <div className="text-base font-black leading-none text-[#e86f3a]">{item.value}</div>
            <div className="mt-1 text-[0.5rem] uppercase tracking-[0.14em] text-[#6f6a61]">{item.label}</div>
          </div>
        ))}
      </div>

      {stats.mostLinked ? (
        <div className="mt-2 border border-[#2a302c] bg-[#080a09] px-2 py-1.5 text-[0.66rem]">
          <div className="text-[0.5rem] uppercase tracking-[0.14em] text-[#6f6a61]">Most linked</div>
          <div className="mt-0.5 truncate font-bold text-[#f4f1e8]">{stats.mostLinked.title}</div>
          <div className="truncate text-[0.6rem] text-[#6f6a61]">
            {stats.mostLinked.path}
            <span className="ml-2 text-[#e86f3a]">{stats.mostLinked.count} backlinks</span>
          </div>
        </div>
      ) : null}

      {msg ? <div className="mt-1.5 text-[0.6rem] text-[#79a875]">{msg}</div> : null}
    </div>
  );
}
