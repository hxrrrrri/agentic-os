"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Usage {
  runs: number;
  cost: number;
  tokens: number;
}

interface Budget {
  id: string;
  window: "day" | "week" | "month";
  maxCostUsd: number;
  maxRuns?: number;
  updatedAt: string;
}

interface BillingPayload {
  today: Usage;
  week: Usage;
  month: Usage;
  daily: Array<{ day: string; cost: number; runs: number }>;
  budgets: Budget[];
}

export function BillingPanel() {
  const [data, setData] = useState<BillingPayload | null>(null);
  const [editing, setEditing] = useState<Budget["window"] | null>(null);
  const [maxCost, setMaxCost] = useState("");
  const [maxRuns, setMaxRuns] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = () =>
    fetch("/api/billing")
      .then((r) => r.json())
      .then((d: BillingPayload) => setData(d))
      .catch(() => {});

  useEffect(() => {
    reload();
  }, []);

  const saveBudget = async (window: Budget["window"]) => {
    setSaving(true);
    try {
      await fetch("/api/billing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          window,
          maxCostUsd: parseFloat(maxCost) || 0,
          maxRuns: maxRuns ? parseInt(maxRuns, 10) : undefined,
        }),
      });
      await reload();
      setEditing(null);
      setMaxCost("");
      setMaxRuns("");
    } finally {
      setSaving(false);
    }
  };

  const maxDaily = Math.max(...(data?.daily ?? []).map((d) => d.cost), 0.01);

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Cost meter</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">BILLING</h1>
        <p className="mt-1 text-sm text-[#a8a29a]">
          Per-run cost tracking + day / week / month budgets. Budgets short-circuit any new run before it spends.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {(["today", "week", "month"] as const).map((k) => {
          const u = data?.[k];
          return (
            <Card key={k} className="p-4">
              <div className="terminal-label">{k}</div>
              <div className="mt-2 text-2xl font-black text-[#f4f1e8]">${(u?.cost ?? 0).toFixed(4)}</div>
              <div className="mt-1 text-[0.66rem] text-[#a8a29a]">
                {u?.runs ?? 0} runs · {(u?.tokens ?? 0).toLocaleString()} tokens
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div className="terminal-label">14-day spend</div>
          <span className="text-[0.6rem] text-[#6f6a61]">max ${maxDaily.toFixed(4)}</span>
        </div>
        <div
          className="mt-3 grid gap-1"
          style={{ gridTemplateColumns: `repeat(${Math.max(1, data?.daily.length ?? 1)}, minmax(0, 1fr))` }}
        >
          {(data?.daily ?? []).map((d) => {
            const pct = Math.max(4, Math.round((d.cost / maxDaily) * 100));
            return (
              <div key={d.day} className="flex flex-col items-center">
                <div className="relative h-20 w-full overflow-hidden rounded-[2px] bg-[#10120f]">
                  <div
                    className="absolute bottom-0 w-full bg-[#e86f3a]/70"
                    style={{ height: `${pct}%` }}
                    title={`$${d.cost.toFixed(4)} · ${d.runs} runs`}
                  />
                </div>
                <div className="mt-1 text-[0.5rem] text-[#6f6a61]">{d.day.slice(5)}</div>
              </div>
            );
          })}
          {(data?.daily ?? []).length === 0 ? (
            <div className="text-center text-[0.7rem] text-[#6f6a61]">No usage in the last 14 days.</div>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <div className="terminal-label">Budgets</div>
        <p className="mt-1 text-[0.7rem] text-[#a8a29a]">
          When a budget is hit, every new run halts immediately with a budget-exceeded failure. Approval-gated runs are still
          queued for manual review.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          {(["day", "week", "month"] as const).map((window) => {
            const budget = data?.budgets.find((b) => b.window === window);
            return (
              <div key={window} className="rounded-[2px] border border-[#2a302c] bg-[#0b0d0a] p-3">
                <div className="flex items-center justify-between">
                  <div className="text-[0.62rem] uppercase tracking-[0.16em] text-[#a8a29a]">{window}</div>
                  {budget ? <Badge tone="orange">${budget.maxCostUsd.toFixed(2)}</Badge> : <Badge tone="gray">unset</Badge>}
                </div>
                {editing === window ? (
                  <div className="mt-3 space-y-2">
                    <input
                      placeholder="Max USD"
                      value={maxCost}
                      onChange={(e) => setMaxCost(e.target.value)}
                      className="w-full rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-1 text-[0.72rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                    />
                    <input
                      placeholder="Max runs (optional)"
                      value={maxRuns}
                      onChange={(e) => setMaxRuns(e.target.value)}
                      className="w-full rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-1 text-[0.72rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => saveBudget(window)}
                        disabled={saving}
                        className="h-7 flex-1 rounded-[2px] border border-[#e86f3a]/60 bg-[#1d1612] text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] hover:bg-[#251914] disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditing(null)}
                        className="h-7 flex-1 rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#e86f3a]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setEditing(window);
                      setMaxCost(budget ? budget.maxCostUsd.toString() : "");
                      setMaxRuns(budget?.maxRuns ? budget.maxRuns.toString() : "");
                    }}
                    className="mt-3 h-7 w-full rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#e86f3a]"
                  >
                    {budget ? "Edit" : "Set budget"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
