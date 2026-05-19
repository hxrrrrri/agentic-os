import { Progress } from "@/components/ui/progress";

export function MetricCard({
  label,
  primary,
  secondary,
  value,
  max,
}: {
  label: string;
  primary: string;
  secondary: string;
  value: number;
  max: number;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <section className="terminal-panel card-lift bg-[#121411] p-3.5">
      <div className="flex items-center justify-between">
        <div className="terminal-label">{label}</div>
        <div className="text-[0.62rem] uppercase tracking-[0.18em] text-[#a8a29a]">
          <span className="text-[#e86f3a] font-bold">{pct}%</span>
          <span className="ml-2 text-[#6f6a61]">resets soon</span>
        </div>
      </div>
      <div className="mt-3">
        <Progress value={value} max={max} />
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div className="text-[1.05rem] font-black tracking-tight text-[#f4f1e8]">{primary}</div>
        <div className="text-[0.68rem] uppercase tracking-[0.1em] text-[#a8a29a]">{secondary}</div>
      </div>
    </section>
  );
}
