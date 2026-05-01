import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { listIntegrations } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await listIntegrations();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Tool Permission Center</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">INTEGRATIONS</h1>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <CardTitle><StatusDot status={integration.status} className="mr-2" />{integration.name}</CardTitle>
              <Badge>{integration.mode}</Badge>
            </CardHeader>
            <div className="text-sm leading-6 text-[#a8a29a]">{integration.description}</div>
            <div className="mt-2 text-xs text-[#6f6a61]">Last used: {formatTime(integration.lastUsed)}</div>
            <div className="mt-3 space-y-2">
              {integration.actions.map((action) => (
                <div key={action.id} className="grid grid-cols-[1fr_auto_auto] gap-2 border border-[#2a302c] bg-[#080a09] p-2 text-xs">
                  <span className="text-[#f4f1e8]">{action.name}</span>
                  <Badge>{action.riskLevel}</Badge>
                  <Badge tone={action.permissionLevel === "disabled" ? "red" : action.permissionLevel === "read-only" ? "green" : "yellow"}>{action.permissionLevel}</Badge>
                </div>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
