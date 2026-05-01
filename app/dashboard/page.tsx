import { Suspense } from "react";
import { ActivityChart } from "@/components/charts/activity-chart";
import { PromptConsole } from "@/components/dashboard/prompt-console";
import { DashboardSidebar } from "@/components/dashboard/sidebar-panels";
import { IntegrationsBar } from "@/components/dashboard/integrations-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { agenticosConfig } from "@/agenticos.config";
import { listIntegrations, listRuns } from "@/lib/db/repositories";
import { usageMetrics, buildActivitySeries, lastSevenDays } from "@/lib/mock/metrics";
import { listSkills } from "@/lib/skills/registry";
import { getRecentVaultFiles } from "@/lib/vault/service";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [runs, integrations, recentFiles] = await Promise.all([listRuns(), listIntegrations(), getRecentVaultFiles()]);
  const metrics = usageMetrics(runs);
  const activity = buildActivitySeries(runs);
  const weekly = lastSevenDays(runs);
  const skills = listSkills();
  const totalRuns = runs.length;
  const last30Count = activity.reduce((sum, point) => sum + point.daily, 0);

  return (
    <div className="space-y-4">
      <section className="terminal-panel scanline overflow-hidden bg-[#101311] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="terminal-label">Claude Code conductor · provider mesh ready</div>
            <h1 className="mt-2 text-3xl font-black tracking-[0.14em] text-[#f4f1e8] md:text-5xl">AGENTIC OS</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#a8a29a]">
              Local-first command center for memory, productivity, research, content, coding, business tools, custom CLIs, APIs, MCP servers, and cloud or local model providers.
            </p>
          </div>
          <div className="border border-[#2a302c] bg-[#080a09] p-3 text-xs text-[#a8a29a]">
            <div className="terminal-label">Vault</div>
            <div className="mt-2 break-all text-[#e86f3a]">{agenticosConfig.vaultPath}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <MetricCard label="5-hour window" primary={`${metrics.fiveHour.used.toLocaleString()} / ${metrics.fiveHour.max.toLocaleString()}`} secondary={`${metrics.fiveHour.sessions} sessions · reset in ${metrics.fiveHour.reset}`} value={metrics.fiveHour.used} max={metrics.fiveHour.max} />
        <MetricCard label="Weekly window" primary={`${metrics.weekly.used} / ${metrics.weekly.max} min`} secondary={`${metrics.weekly.sessions} sessions · ${Math.round((metrics.weekly.used / metrics.weekly.max) * 100)}% used`} value={metrics.weekly.used} max={metrics.weekly.max} />
        <MetricCard label="Routines" primary={`${metrics.routines.completed} / ${metrics.routines.max}`} secondary={`${metrics.routines.value} estimated value · reset at midnight`} value={metrics.routines.completed} max={metrics.routines.max} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Agentic OS · Cumulative Activity · 30D</CardTitle>
              <div className="text-right text-xs text-[#a8a29a]">
                <div className="text-[#e86f3a]">{totalRuns} total runs</div>
                <div>{last30Count} last 30 days</div>
              </div>
            </CardHeader>
            <ActivityChart data={activity} />
          </Card>
          <IntegrationsBar integrations={integrations} />
          <Suspense fallback={<div className="terminal-panel p-4 text-sm text-[#a8a29a]">Loading console...</div>}>
            <PromptConsole skills={skills} />
          </Suspense>
        </div>
        <DashboardSidebar runs={runs} weekly={weekly} recentFiles={recentFiles} />
      </div>
    </div>
  );
}
