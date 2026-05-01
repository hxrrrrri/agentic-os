import { cn } from "@/lib/utils";
import type { IntegrationStatus, RunStatus } from "@/types";

const colors: Record<string, string> = {
  connected: "bg-[#79a875]",
  partial: "bg-[#c99a45]",
  disconnected: "bg-[#c4605a]",
  not_configured: "bg-[#6f6a61]",
  completed: "bg-[#79a875]",
  running: "bg-[#e86f3a]",
  planning: "bg-[#c99a45]",
  queued: "bg-[#6f6a61]",
  waiting_for_approval: "bg-[#c99a45]",
  failed: "bg-[#c4605a]",
  cancelled: "bg-[#6f6a61]",
};

export function StatusDot({ status, className }: { status: IntegrationStatus | RunStatus | string; className?: string }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", colors[status] ?? "bg-[#6f6a61]", className)} />;
}
