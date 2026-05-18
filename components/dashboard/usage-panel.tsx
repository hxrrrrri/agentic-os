import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getDayUsage, getWindowUsage, getRecentUsageDaily } from "@/lib/billing/meter";

function fmtUsd(n: number): string {
  if (n === 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${n}`;
}

export async function UsagePanel() {
  const [today, week, recent] = await Promise.all([
    getDayUsage(),
    getWindowUsage(7),
    getRecentUsageDaily(14),
  ]);

  const maxCost = Math.max(0.001, ...recent.map((d) => d.cost));

  return (
    <Card className="p-3">
      <CardHeader>
        <CardTitle>Spend &amp; Token Usage</CardTitle>
        <div className="text-right text-[0.58rem] uppercase tracking-[0.12em] text-[#a8a29a]">
          {recent.length} active days
        </div>
      </CardHeader>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Stat label="Today" cost={fmtUsd(today.cost)} runs={today.runs} tokens={fmtTokens(today.tokens)} />
        <Stat label="Last 7 days" cost={fmtUsd(week.cost)} runs={week.runs} tokens={fmtTokens(week.tokens)} />
        <Stat label="14d avg / day" cost={fmtUsd(recent.length ? week.cost / Math.max(1, recent.length) : 0)} runs={recent.length ? Math.round(week.runs / Math.max(1, recent.length)) : 0} tokens="—" />
      </div>

      {recent.length > 0 ? (
        <div className="mt-3">
          <div className="mb-2 text-[0.55rem] uppercase tracking-[0.16em] text-[#6f6a61]">
            cost per day · last {recent.length}d
          </div>
          <div className="flex h-12 items-end gap-1">
            {recent.map((d) => {
              const heightPct = Math.max(4, Math.round((d.cost / maxCost) * 100));
              return (
                <div
                  key={d.day}
                  title={`${d.day} · ${fmtUsd(d.cost)} · ${d.runs} runs`}
                  className="flex-1 rounded-[2px] bg-[#e86f3a]/70"
                  style={{ height: `${heightPct}%`, minHeight: "3px" }}
                />
              );
            })}
          </div>
        </div>
      ) : (
        <div className="mt-3 text-[0.66rem] text-[#6f6a61]">
          No usage recorded yet. Run a skill that uses a model — costs land here.
        </div>
      )}
    </Card>
  );
}

function Stat({ label, cost, runs, tokens }: { label: string; cost: string; runs: number; tokens: string }) {
  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0c0e10] p-3">
      <div className="text-[0.55rem] uppercase tracking-[0.16em] text-[#a8a29a]">{label}</div>
      <div className="mt-1 text-[20px] font-black leading-none tracking-tight text-[#e86f3a]">{cost}</div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[0.62rem] text-[#8b857b]">
        <div>
          <span className="text-[#f4f1e8]">{runs}</span> runs
        </div>
        <div className="text-right">
          <span className="text-[#f4f1e8]">{tokens}</span> tok
        </div>
      </div>
    </div>
  );
}
