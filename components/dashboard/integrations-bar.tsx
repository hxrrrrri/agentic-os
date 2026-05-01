import { StatusDot } from "@/components/ui/status-dot";
import type { Integration } from "@/types";

export function IntegrationsBar({ integrations }: { integrations: Integration[] }) {
  return (
    <section className="terminal-panel flex min-h-7 flex-wrap items-center gap-3 bg-[#121411] px-3 py-2">
      <span className="terminal-label mr-1 text-[#e86f3a]">Integrations</span>
      <span className="h-3 w-px bg-[#30342c]" />
      {integrations.slice(0, 7).map((integration) => (
        <span key={integration.id} className="inline-flex items-center gap-1.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[#d0ccc2]">
          <StatusDot status={integration.status} />
          {integration.name}:{integration.id}
        </span>
      ))}
    </section>
  );
}
