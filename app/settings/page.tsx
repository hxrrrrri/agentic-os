import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ModelProviderProfiles } from "@/components/settings/model-provider-profiles";
import { agenticosConfig } from "@/agenticos.config";
import { listModelProviders } from "@/lib/agent/providers";
import { getProjectContextManifest } from "@/lib/agent/project-context";

export default async function SettingsPage() {
  const providers = listModelProviders();
  const projectContextFiles = await getProjectContextManifest();
  const contextCategories = Array.from(new Set(projectContextFiles.map((file) => file.category)));

  const modeFromEnv = Boolean(process.env.AGENTICOS_MODE);
  const providerFromEnv = Boolean(process.env.AGENTICOS_PROVIDER);
  const hasModelKey =
    Boolean(process.env.NVIDIA_API_KEY) ||
    Boolean(process.env.OPENAI_API_KEY) ||
    Boolean(process.env.ANTHROPIC_API_KEY) ||
    Boolean(process.env.GEMINI_API_KEY) ||
    Boolean(process.env.OPENROUTER_API_KEY) ||
    Boolean(process.env.GROK_API_KEY) ||
    Boolean(process.env.XAI_API_KEY);
  const effectiveMode = agenticosConfig.mode === "real" && hasModelKey ? "real" : agenticosConfig.mode;
  const modeTone =
    effectiveMode === "real" ? "green" : agenticosConfig.mode === "real" ? "yellow" : "gray";

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
            <div className="border border-[#2a302c] bg-[#080a09] p-3">
              <div className="flex items-center justify-between">
                <div className="terminal-label">Mode</div>
                <Badge tone={modeTone}>{effectiveMode}</Badge>
              </div>
              <div className="mt-2 text-[#a8a29a]">
                AGENTICOS_MODE = {modeFromEnv ? <span className="text-[#f4f1e8]">{process.env.AGENTICOS_MODE}</span> : <span className="text-[#6f6a61]">unset (defaults to mock)</span>}
              </div>
              <div className="mt-1 text-[#a8a29a]">
                AGENTICOS_PROVIDER = {providerFromEnv ? <span className="text-[#f4f1e8]">{process.env.AGENTICOS_PROVIDER}</span> : <span className="text-[#6f6a61]">unset (defaults to claude-code)</span>}
              </div>
              {agenticosConfig.mode === "real" && !hasModelKey ? (
                <div className="mt-2 text-[#c99a45]">
                  Mode is real but no model API key is set — runs will fall back to mock output. Add one of NVIDIA_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, OPENROUTER_API_KEY, GROK_API_KEY/XAI_API_KEY to .env.local and restart `npm run dev`.
                </div>
              ) : null}
              {agenticosConfig.mode !== "real" ? (
                <div className="mt-2 text-[#6f6a61]">
                  Set <code className="text-[#e86f3a]">AGENTICOS_MODE=real</code> in <code>.env.local</code> and restart to switch live integrations on.
                </div>
              ) : null}
            </div>
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
