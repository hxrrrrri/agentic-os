export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="h-2 w-full border border-[#2a302c] bg-[#080a09]">
      <div className="h-full bg-[#e86f3a]" style={{ width: `${percentage}%` }} />
    </div>
  );
}
