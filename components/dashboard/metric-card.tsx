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
  return (
    <section className="terminal-panel bg-[#121411] p-2.5">
      <div className="flex items-center justify-between">
        <div className="terminal-label">{label}</div>
        <div className="text-[0.52rem] uppercase tracking-[0.18em] text-[#6f6a61]">resets - now</div>
      </div>
      <div className="mt-2">
        <Progress value={value} max={max} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-3">
        <div className="text-base font-black text-[#f4f1e8]">{primary}</div>
        <div className="text-[0.58rem] uppercase tracking-[0.1em] text-[#8b857b]">{secondary}</div>
      </div>
    </section>
  );
}
