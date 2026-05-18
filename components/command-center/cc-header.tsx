"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RotateCw } from "lucide-react";

export type CommandCenterTab = "OVERVIEW" | "AUDIENCE" | "RESEARCH";

const tabs: CommandCenterTab[] = ["OVERVIEW", "AUDIENCE", "RESEARCH"];

interface Props {
  activeTab: CommandCenterTab;
  onTabChange?: (tab: CommandCenterTab) => void;
}

export function CommandCenterHeader({ activeTab, onTabChange }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());
  return (
    <div className="cc-header m-[6px_8px_0] border border-[#332522] bg-[#171312] px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-[8px]">
          {tabs.map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange?.(tab)}
                className={`cc-tab inline-flex h-10 min-w-[150px] items-center justify-center rounded-[2px] border px-5 text-[0.8rem] font-bold uppercase tracking-[0.12em] transition ${
                  active
                    ? "border-[#e97848]/80 bg-[#2d211d] text-[#fff6ed]"
                    : "border-[#4a4a4a] bg-[#2b2d2f] text-[#e4ded4] hover:border-[#e97848]/60 hover:text-[#e97848]"
                }`}
              >
                {active ? `[ ${tab} ]` : tab}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="cc-live-pill inline-flex h-8 items-center gap-[6px] rounded-[1px] border border-[#e97848]/70 bg-[#140d0b] px-3 text-[0.76rem] font-bold uppercase tracking-[0.12em] text-[#e97848]">
            <span className="cc-live-dot h-[5px] w-[5px] rounded-full bg-[#e97848]" />
            Live
          </span>
          <button
            type="button"
            onClick={refresh}
            disabled={pending}
            className="inline-flex h-8 w-8 items-center justify-center rounded-[1px] border border-[#424242] bg-[#242424] text-[#b8b2aa] transition hover:border-[#e97848] hover:text-[#e97848] disabled:opacity-50"
            aria-label="Refresh"
          >
            <RotateCw size={14} className={pending ? "animate-spin" : undefined} />
          </button>
        </div>
      </div>
    </div>
  );
}
