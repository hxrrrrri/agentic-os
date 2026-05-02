import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { ModelProviderProfiles } from "@/components/settings/model-provider-profiles";
import { agenticosConfig } from "@/agenticos.config";
import { listModelProviders } from "@/lib/agent/providers";
import { getProjectContextManifest } from "@/lib/agent/project-context";

export default async function SettingsPage() {
  const providers = listModelProviders();
  const projectContextFiles = await getProjectContextManifest();
  const contextCategories = Array.from(new Set(projectContextFiles.map((file) => file.category)));

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
          <ModelProviderProfiles providers={providers} />
        </Card>
        <Card>
          <CardHeader><CardTitle>Project Intelligence</CardTitle></CardHeader>
          <div className="space-y-3 text-sm">
            <div className="border border-[#2a302c] bg-[#080a09] p-3">
              <div className="terminal-label">Context path</div>
              <div className="mt-2 break-all text-[#e86f3a]">{agenticosConfig.projectContextPath}</div>
            </div>
            <div className="grid gap-2 text-xs">
              <div className="border border-[#2a302c] bg-[#080a09] p-3">
                <div className="terminal-label">Loaded markdown</div>
                <div className="mt-2 text-[#f4f1e8]">{projectContextFiles.length} file(s)</div>
                <div className="mt-1 text-[#6f6a61]">{contextCategories.join(" / ")}</div>
              </div>
              <div className="max-h-52 space-y-1 overflow-auto thin-scrollbar">
                {projectContextFiles.map((file) => (
                  <div key={file.path} className="grid grid-cols-[1fr_auto] gap-2 border border-[#2a302c] bg-[#080a09] p-2">
                    <span className="truncate text-[#a8a29a]">{file.path}</span>
                    <span className="text-[#6f6a61]">{file.chars.toLocaleString()} chars</span>
                  </div>
                ))}
              </div>
            </div>
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
