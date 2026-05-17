interface TokenBurnProps {
  percent?: number;
  used?: string;
  max?: string;
  projDelta?: string;
  lastPullMinutes?: number;
}

export function TokenBurn({
  percent = 16,
  used = "312.51K",
  max = "2M",
  projDelta = "+1.02% PROJ",
  lastPullMinutes = 18,
}: TokenBurnProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div className="cc-token-card relative overflow-hidden rounded-[3px] border border-[#3a2a1f] bg-[#100c0a] p-4">
      <div className="flex items-center justify-between text-[0.55rem] uppercase tracking-[0.18em]">
        <div className="flex items-center gap-[6px] text-[#a8a29a]">
          <span className="text-[#e86f3a]">$</span>
          <span>Token Burn</span>
          <span className="text-[#3d4239]">·</span>
          <span>5H Window</span>
          <span className="text-[#3d4239]">·</span>
          <span className="inline-flex items-center gap-[5px] text-[#e86f3a]">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#e86f3a]" />
            Live
          </span>
        </div>
        <span className="text-[#6f6a61]">last pull {lastPullMinutes}m ago</span>
      </div>

      <div className="mt-4 grid grid-cols-[auto_1fr_auto] items-center gap-5">
        <div className="font-black leading-none tracking-tight text-[#e86f3a] text-[58px]">
          {clamped}
          <span className="ml-1 text-[28px] font-black">%</span>
        </div>

        <div className="relative">
          <div className="cc-burn-bar relative h-[42px] overflow-hidden rounded-[2px] border border-[#3a2a1f] bg-[#0b0a09]">
            <div
              className="cc-burn-fill h-full transition-[width] duration-700"
              style={{ width: `${clamped}%` }}
            />
            <div className="cc-burn-track absolute inset-0 pointer-events-none" />
          </div>
          <div className="mt-[6px] flex justify-between px-[2px] text-[0.52rem] uppercase tracking-[0.18em] text-[#6f6a61]">
            <span />
            <span>500K</span>
            <span>1M</span>
            <span>1.5M</span>
            <span>2M</span>
          </div>
        </div>

        <div className="text-right">
          <div className="font-black tracking-tight text-[#f4f1e8] text-[26px] leading-none">
            {used}
          </div>
          <div className="mt-[3px] text-[0.62rem] uppercase tracking-[0.16em] text-[#8b857b]">
            / {max}
          </div>
          <div className="mt-[3px] text-[0.55rem] uppercase tracking-[0.18em] text-[#e86f3a]/85">
            ▲ {projDelta}
          </div>
        </div>
      </div>
    </div>
  );
}
