import { Suspense } from "react";
import { ActivityChart } from "@/components/charts/activity-chart";
import { PromptConsole } from "@/components/dashboard/prompt-console";
import { DashboardSidebar } from "@/components/dashboard/sidebar-panels";
import { IntegrationsBar } from "@/components/dashboard/integrations-bar";
import { MetricCard } from "@/components/dashboard/metric-card";
import { UsagePanel } from "@/components/dashboard/usage-panel";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listIntegrations, listRuns } from "@/lib/db/repositories";
import { usageMetrics, buildActivitySeries, lastSevenDays } from "@/lib/mock/metrics";
import { listModelProviders } from "@/lib/agent/providers";
import { listSkills } from "@/lib/skills/registry";
import { getRecentVaultFiles } from "@/lib/vault/service";
export const dynamic = "force-dynamic";

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`.replace(/\.00M$/, "M");
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`.replace(/\.0K$/, "K");
  return n.toLocaleString("en-US");
}

export default async function DashboardPage() {
  const [runs, integrations, recentFiles] = await Promise.all([listRuns(), listIntegrations(), getRecentVaultFiles()]);
  const metrics = usageMetrics(runs);
  const activity = buildActivitySeries(runs);
  const weekly = lastSevenDays(runs);
  const skills = listSkills();
  const providers = listModelProviders();
  const totalRuns = runs.length;
  const last30Count = activity.reduce((sum, point) => sum + point.daily, 0);

  return (
    <div className="page-enter space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        <div className="stagger-item">
          <MetricCard
            label="5-hour window"
            primary={`${compact(metrics.fiveHour.used)} / ${compact(metrics.fiveHour.max)}`}
            secondary={`${metrics.fiveHour.sessions} sessions`}
            value={metrics.fiveHour.used}
            max={metrics.fiveHour.max}
          />
        </div>
        <div className="stagger-item">
          <MetricCard
            label="Weekly window"
            primary={`${compact(metrics.weekly.used)}m / ${compact(metrics.weekly.max)}m`}
            secondary={`${metrics.weekly.sessions} sessions`}
            value={metrics.weekly.used}
            max={metrics.weekly.max}
          />
        </div>
        <div className="stagger-item">
          <MetricCard
            label="Routines - max"
            primary={`${metrics.routines.completed} / ${metrics.routines.max}`}
            secondary={`${metrics.routines.value} today`}
            value={metrics.routines.completed}
            max={metrics.routines.max}
          />
        </div>
      </div>

      <Card className="chart-grid card-lift p-3">
        <CardHeader>
          <CardTitle>Agentic OS - Cumulative Activity - 30D</CardTitle>
          <div className="text-right text-[0.66rem] uppercase tracking-[0.12em] text-[#a8a29a]">
            <span className="text-[#e86f3a] font-bold">+ {totalRuns} total</span>
            <span className="ml-2 text-[#6f6a61]">{last30Count} last 30d</span>
          </div>
        </CardHeader>
        <ActivityChart data={activity} />
      </Card>

      <Suspense fallback={<div className="terminal-panel p-3 text-sm text-[#a8a29a]">Loading usage...</div>}>
        <UsagePanel />
      </Suspense>

      <IntegrationsBar integrations={integrations} />

      <div className="grid gap-4 pt-5 xl:grid-cols-[1fr_286px]">
        <div className="min-w-0 space-y-8">
          <Suspense fallback={<div className="terminal-panel p-4 text-sm text-[#a8a29a]">Loading console...</div>}>
            <PromptConsole skills={skills} providers={providers} />
          </Suspense>
        </div>
        <DashboardSidebar runs={runs} weekly={weekly} recentFiles={recentFiles} />
      </div>
    </div>
  );
}
