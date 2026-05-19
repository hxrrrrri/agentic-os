export function Progress({ value, max = 100 }: { value: number; max?: number }) {
  const percentage = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      className="segmented-meter w-full"
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span style={{ width: `${percentage}%` }} />
    </div>
  );
}
