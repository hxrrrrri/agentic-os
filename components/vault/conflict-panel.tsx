"use client";

import { useState, useTransition } from "react";
import type { ConflictResult } from "@/lib/vault/conflict";

const SEVERITY_COLOR = { high: "#c4605a", medium: "#c99a45", low: "#6f6a61" };
const TYPE_LABEL = {
  "duplicate-title": "Duplicate",
  "broken-link": "Broken Link",
  "dead-reference": "Dead Ref",
};

export function ConflictPanel({ initial }: { initial: ConflictResult[] }) {
  const [conflicts, setConflicts] = useState(initial);
  const [isPending, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  function rescan() {
    setMsg(null);
    startTransition(async () => {
      const res = await fetch("/api/vault/conflict");
      const data = (await res.json()) as { conflicts?: ConflictResult[]; error?: string };
      if (data.conflicts) {
        setConflicts(data.conflicts);
        setMsg(`Found ${data.conflicts.length} issue${data.conflicts.length !== 1 ? "s" : ""}`);
      } else {
        setMsg(data.error ?? "Scan failed");
      }
    });
  }

  const isEmpty = conflicts.length === 0 && !msg;

  return (
    <div className="terminal-panel bg-[#121411] px-3 py-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="terminal-label text-[#f4f1e8]">Conflicts</span>
          {conflicts.length > 0 ? (
            <span className="rounded-[2px] border border-[#c4605a]/40 bg-[#c4605a]/10 px-[6px] py-[1px] text-[0.52rem] font-bold uppercase tracking-[0.14em] text-[#c4605a]">
              {conflicts.length}
            </span>
          ) : (
            <span className="rounded-[2px] border border-[#79a875]/40 bg-[#79a875]/10 px-[6px] py-[1px] text-[0.52rem] font-bold uppercase tracking-[0.14em] text-[#79a875]">
              Clean
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={rescan}
          disabled={isPending}
          className="text-[0.6rem] uppercase tracking-[0.14em] text-[#6f6a61] transition hover:text-[#e86f3a] disabled:opacity-50"
        >
          {isPending ? "Scanning…" : "Re-scan"}
        </button>
      </div>

      {msg ? <div className="mt-1.5 text-[0.62rem] text-[#a8a29a]">{msg}</div> : null}

      {/* Skip the empty-state line entirely — the "Clean" badge already
          communicates the state, no need for a second sentence. */}
      {!isEmpty && conflicts.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {conflicts.map((c, i) => (
            <div key={i} className="border border-[#2a302c] bg-[#080a09] p-1.5">
              <div className="flex items-start gap-2">
                <span
                  className="mt-[2px] shrink-0 rounded-[2px] border px-[5px] py-[1px] text-[0.5rem] font-bold uppercase tracking-[0.12em]"
                  style={{
                    borderColor: `${SEVERITY_COLOR[c.severity]}60`,
                    color: SEVERITY_COLOR[c.severity],
                    background: `${SEVERITY_COLOR[c.severity]}12`,
                  }}
                >
                  {TYPE_LABEL[c.type]}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-[0.66rem] font-bold text-[#f4f1e8]">{c.noteA.split("/").pop()}</div>
                  {c.noteB ? <div className="truncate text-[0.6rem] text-[#8b857b]">↔ {c.noteB.split("/").pop()}</div> : null}
                  <div className="mt-[2px] text-[0.6rem] leading-[1.4] text-[#6f6a61]">{c.detail}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
