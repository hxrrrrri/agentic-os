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
    <div className="cc-token-card cc-panel p-[16px_18px]">
      <div className="relative z-[1] flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[0.78rem] uppercase tracking-[0.1em]">
        <div className="flex flex-wrap items-center gap-x-[6px] gap-y-1 text-[#a8a29a]">
          <span className="text-[#e86f3a]">$</span>
          <span>Token Burn</span>
          <span className="text-[#3d4239]">·</span>
          <span>5H Window</span>
          <span className="text-[#3d4239]">·</span>
          <span className="cc-live-pill inline-flex items-center gap-[5px] text-[#e86f3a]">
            <span className="cc-live-dot h-[5px] w-[5px] rounded-full bg-[#e86f3a]" />
            Live
          </span>
        </div>
        <span className="text-[#6f6a61]">last pull {lastPullMinutes}m ago</span>
      </div>

      <div className="relative z-[1] mt-4 grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-5 gap-y-4 sm:grid-cols-[110px_minmax(0,1fr)_140px] sm:gap-6">
        <div className="text-[58px] font-black leading-none tracking-tight text-[#e97848] sm:text-[70px]">
          {clamped}
          <span className="ml-1 text-[28px] font-black sm:text-[34px]">%</span>
        </div>

        <div className="relative">
          <div className="cc-burn-bar relative h-[46px] overflow-hidden rounded-[1px] border border-[#3a2a1f] bg-[#090909]">
            <div
              className="cc-burn-fill h-full transition-[width] duration-700"
              style={{ width: `${clamped}%` }}
            />
            <div className="cc-burn-track pointer-events-none absolute inset-0" />
          </div>
          <div className="mt-[7px] flex justify-between px-[2px] text-[0.72rem] uppercase tracking-[0.08em] text-[#8d877e]">
            <span>0</span>
            <span>500K</span>
            <span>1M</span>
            <span>1.5M</span>
            <span>2M</span>
          </div>
        </div>

        <div className="col-span-2 grid grid-cols-[1fr_auto_auto] items-end gap-2 text-left sm:col-span-1 sm:block sm:text-right">
          <div className="text-[28px] font-black leading-none tracking-tight text-[#f4f1e8] sm:text-[34px]">
            {used}
          </div>
          <div className="mt-[5px] text-[0.72rem] uppercase tracking-[0.14em] text-[#8b857b]">
            / {max}
          </div>
          <div className="mt-[5px] text-[0.68rem] uppercase tracking-[0.16em] text-[#e86f3a]/85">
            ▲ {projDelta}
          </div>
        </div>
      </div>
    </div>
  );
}
