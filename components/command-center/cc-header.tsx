"use client";

import { RotateCw } from "lucide-react";
import { AgenticOsLogo } from "@/components/layout/agenticos-logo";

export type CommandCenterTab = "OVERVIEW" | "AUDIENCE" | "RESEARCH";

const tabs: CommandCenterTab[] = ["OVERVIEW", "AUDIENCE", "RESEARCH"];

interface Props {
  activeTab: CommandCenterTab;
  onTabChange?: (tab: CommandCenterTab) => void;
}

export function CommandCenterHeader({ activeTab, onTabChange }: Props) {
  return (
    <div className="border-b border-[#1d211b] bg-[#0b0d0a] px-5 pb-3 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AgenticOsLogo className="h-7 w-7" />
          <div className="text-[18px] font-black leading-none tracking-[0.16em] text-[#f4f1e8]">
            AGENTIC<span className="ml-[6px] text-[#f4f1e8]">OS</span>
          </div>
        </div>
        <div className="flex items-center gap-[6px]">
          <span className="inline-flex h-[22px] items-center gap-[6px] rounded-[2px] border border-[#e86f3a]/40 bg-[#e86f3a]/10 px-2 text-[0.56rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">
            <span className="h-[5px] w-[5px] animate-pulse rounded-full bg-[#e86f3a]" />
            Live
          </span>
          <button
            type="button"
            className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
            aria-label="Refresh"
          >
            <RotateCw size={11} />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-[6px]">
        {tabs.map((tab) => {
          const active = tab === activeTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => onTabChange?.(tab)}
              className={`inline-flex h-7 items-center rounded-[3px] border px-3 text-[0.62rem] font-bold tracking-[0.14em] transition ${
                active
                  ? "border-[#e86f3a] bg-[#1d1612] text-[#e86f3a]"
                  : "border-[#2a302c] bg-[#10120f] text-[#8b857b] hover:border-[#e86f3a]/40 hover:text-[#e86f3a]"
              }`}
            >
              {active ? `[ ${tab} ]` : tab}
            </button>
          );
        })}
      </div>
    </div>
  );
}
