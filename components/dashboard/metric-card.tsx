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
    <section className="terminal-panel bg-[#101311] p-4">
      <div className="terminal-label">{label}</div>
      <div className="mt-3 text-2xl font-black text-[#f4f1e8]">{primary}</div>
      <div className="mt-3">
        <Progress value={value} max={max} />
      </div>
      <div className="mt-3 text-xs text-[#a8a29a]">{secondary}</div>
    </section>
  );
}
