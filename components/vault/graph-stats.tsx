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
    <div className="terminal-panel bg-[#121411] p-3">
      <div className="mb-2 terminal-label text-[#f4f1e8]">Graph Index</div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        {items.map((item) => (
          <div key={item.label} className="border border-[#2a302c] bg-[#080a09] p-2 text-center">
            <div className="text-xl font-black text-[#e86f3a]">{item.value}</div>
            <div className="mt-1 text-[0.55rem] uppercase tracking-[0.14em] text-[#6f6a61]">{item.label}</div>
          </div>
        ))}
      </div>

      {stats.mostLinked ? (
        <div className="border border-[#2a302c] bg-[#080a09] p-2 text-xs">
          <div className="terminal-label mb-1">Most linked</div>
          <div className="truncate font-bold text-[#f4f1e8]">{stats.mostLinked.title}</div>
          <div className="mt-1 text-[#6f6a61]">
            {stats.mostLinked.path}
            <span className="ml-2 text-[#e86f3a]">{stats.mostLinked.count} backlinks</span>
          </div>
        </div>
      ) : (
        <div className="text-xs text-[#6f6a61]">No notes indexed yet.</div>
      )}

      {msg ? <div className="mt-2 text-[0.62rem] text-[#79a875]">{msg}</div> : null}

      <button
        type="button"
        onClick={reindex}
        disabled={isPending}
        className="mt-2 w-full rounded-[3px] border border-[#2a302c] bg-[#10120f] px-3 py-2 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-50 disabled:cursor-wait"
      >
        {isPending ? "Indexing…" : "Re-index vault graph"}
      </button>
    </div>
  );
}
