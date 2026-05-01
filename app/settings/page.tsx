import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { agenticosConfig } from "@/agenticos.config";
import { listModelProviders } from "@/lib/agent/providers";

export default function SettingsPage() {
  const providers = listModelProviders();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Control Plane</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">SETTINGS</h1>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Vault and Runtime</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            <div className="border border-[#2a302c] bg-[#080a09] p-3"><div className="terminal-label">Vault path</div><div className="mt-2 break-all text-[#e86f3a]">{agenticosConfig.vaultPath}</div></div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3"><div className="terminal-label">Database path</div><div className="mt-2 break-all text-[#e86f3a]">{agenticosConfig.databasePath}</div></div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3"><div className="terminal-label">Mode</div><div className="mt-2 text-[#a8a29a]">{agenticosConfig.mode}</div></div>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Token Budgets</CardTitle></CardHeader>
          <div className="grid gap-2 text-sm">
            <div className="border border-[#2a302c] bg-[#080a09] p-3">5H token cap: {agenticosConfig.budgets.fiveHourTokens.toLocaleString()}</div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3">Weekly minute cap: {agenticosConfig.budgets.weeklyMinutes.toLocaleString()}</div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3">Daily routine cap: {agenticosConfig.budgets.dailyRoutines.toLocaleString()}</div>
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Model Providers</CardTitle></CardHeader>
          <div className="space-y-2">
            {providers.map((provider) => (
              <div key={provider.id} className="grid grid-cols-[1fr_auto_auto] gap-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <div>
                  <div className="text-[#f4f1e8]">{provider.provider}</div>
                  <div className="mt-1 text-[#6f6a61]">{provider.model}{provider.baseUrl ? ` · ${provider.baseUrl}` : ""}</div>
                </div>
                <Badge>{provider.mode}</Badge>
                <Badge tone={provider.enabled ? "green" : "gray"}>{provider.enabled ? "enabled" : "disabled"}</Badge>
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader><CardTitle>Permission Defaults</CardTitle></CardHeader>
          <div className="space-y-2 text-sm leading-6 text-[#a8a29a]">
            <div className="border border-[#2a302c] bg-[#080a09] p-3">Read operations can run in mock or read-only mode.</div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3">Draft creation is allowed when no external publish/send action occurs.</div>
            <div className="border border-[#2a302c] bg-[#080a09] p-3">Writes, deletes, pushes, payments, publishing, secrets, installs, and unrestricted shell commands require approval.</div>
          </div>
        </Card>
      </div>
    </div>
  );
}
