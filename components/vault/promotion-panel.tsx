"use client";

import { useState, useTransition } from "react";
import type { VaultNode } from "@/lib/db/repositories";

export function PromotionPanel({ initial }: { initial: VaultNode[] }) {
  const [candidates, setCandidates] = useState(initial);
  const [promoted, setPromoted] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Map<string, string>>(new Map());
  const [isPending, startTransition] = useTransition();

  function promote(node: VaultNode) {
    startTransition(async () => {
      try {
        const res = await fetch("/api/vault/promote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: node.path }),
        });
        const data = (await res.json()) as { ok?: boolean; newPath?: string; error?: string };
        if (data.ok) {
          setPromoted((p) => new Set([...p, node.path]));
          setCandidates((c) => c.filter((n) => n.path !== node.path));
        } else {
          setErrors((e) => new Map([...e, [node.path, data.error ?? "Failed"]]));
        }
      } catch {
        setErrors((e) => new Map([...e, [node.path, "Network error"]]));
      }
    });
  }

  if (candidates.length === 0 && promoted.size === 0) return null;

  return (
    <div className="terminal-panel bg-[#121411] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="terminal-label text-[#f4f1e8]">Promotion Candidates</div>
        <span className="rounded-[2px] border border-[#e86f3a]/40 bg-[#e86f3a]/10 px-[6px] py-[1px] text-[0.52rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a]">
          ≥3 backlinks
        </span>
      </div>

      {promoted.size > 0 ? (
        <div className="mb-3 text-[0.66rem] text-[#79a875]">
          {promoted.size} note{promoted.size > 1 ? "s" : ""} promoted to wiki/
        </div>
      ) : null}

      <div className="space-y-2">
        {candidates.map((node) => (
          <div key={node.path} className="border border-[#2a302c] bg-[#080a09] p-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-[0.78rem] font-bold text-[#f4f1e8]">{node.title}</div>
                <div className="mt-[2px] truncate text-[0.62rem] text-[#6f6a61]">{node.path}</div>
                <div className="mt-1 flex items-center gap-3 text-[0.58rem] uppercase tracking-[0.12em]">
                  <span className="text-[#e86f3a]">{node.backlinkCount ?? 0} backlinks</span>
                  <span className="text-[#6f6a61]">{node.wordCount} words</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => promote(node)}
                disabled={isPending}
                className="shrink-0 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#a8a29a] transition hover:border-[#79a875] hover:text-[#79a875] disabled:cursor-wait disabled:opacity-50"
              >
                → wiki/
              </button>
            </div>
            {errors.get(node.path) ? (
              <div className="mt-1 text-[0.6rem] text-[#c4605a]">{errors.get(node.path)}</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
