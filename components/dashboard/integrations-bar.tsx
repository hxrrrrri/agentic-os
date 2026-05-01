import { StatusDot } from "@/components/ui/status-dot";
import type { Integration } from "@/types";

export function IntegrationsBar({ integrations }: { integrations: Integration[] }) {
  return (
    <section className="terminal-panel flex flex-wrap items-center gap-3 bg-[#101311] p-3">
      <span className="terminal-label mr-2">Integrations</span>
      {integrations.map((integration) => (
        <span key={integration.id} className="inline-flex items-center gap-2 border border-[#2a302c] bg-[#080a09] px-2 py-1 text-[0.68rem] uppercase tracking-[0.08em] text-[#a8a29a]">
          <StatusDot status={integration.status} />
          {integration.name}
        </span>
      ))}
    </section>
  );
}
