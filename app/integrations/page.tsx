import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { listIntegrations } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();
  return (
    <div className="page-enter space-y-3">
      <div>
        <div className="terminal-label">Tool Permission Center</div>
        <h1 className="mt-1 text-3xl font-black tracking-[0.12em]">INTEGRATIONS</h1>
      </div>
      <div className="grid gap-2 lg:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id} className="card-lift stagger-item">
            <CardHeader>
              <CardTitle>
                <StatusDot status={integration.status} className="mr-2" />
                {integration.name}
                <span className="ml-2 text-[0.55rem] font-normal uppercase tracking-[0.14em] text-[#6f6a61]">
                  {formatTime(integration.lastUsed) || "never used"}
                </span>
              </CardTitle>
              <Badge>{integration.mode}</Badge>
            </CardHeader>
            <div className="text-[0.72rem] leading-5 text-[#a8a29a]">{integration.description}</div>
            {integration.actions.length ? (
              <div className="mt-1.5 divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {integration.actions.map((action) => (
                  <div key={action.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 px-2 py-1 text-[0.68rem]">
                    <span className="truncate text-[#f4f1e8]">{action.name}</span>
                    <Badge>{action.riskLevel}</Badge>
                    <Badge tone={action.permissionLevel === "disabled" ? "red" : action.permissionLevel === "read-only" ? "green" : "yellow"}>
                      {action.permissionLevel}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : null}
          </Card>
        ))}
      </div>
    </div>
  );
}
