"use client";

import { useState, type ReactNode } from "react";
import { CommandCenterHeader, type CommandCenterTab } from "@/components/command-center/cc-header";

export function CommandCenterShell({
  overview,
  audience,
  research,
}: {
  overview: ReactNode;
  audience: ReactNode;
  research: ReactNode;
}) {
  const [tab, setTab] = useState<CommandCenterTab>("OVERVIEW");
  return (
    <>
      <CommandCenterHeader activeTab={tab} onTabChange={setTab} />
      <div className="px-[8px] pb-0 pt-[8px]">
        <div key={tab} className="page-enter-soft" role="tabpanel">
          {tab === "OVERVIEW" ? overview : tab === "AUDIENCE" ? audience : research}
        </div>
      </div>
    </>
  );
}
