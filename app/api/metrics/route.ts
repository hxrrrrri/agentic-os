import { NextResponse } from "next/server";
import { listIntegrations, listRuns } from "@/lib/db/repositories";
import { usageMetrics, buildActivitySeries, lastSevenDays } from "@/lib/mock/metrics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [runs, integrations] = await Promise.all([
    listRuns().catch(() => []),
    listIntegrations().catch(() => []),
  ]);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    source: "agenticos.sqlite",
    usage: usageMetrics(runs),
    activity30d: buildActivitySeries(runs),
    lastSevenDays: lastSevenDays(runs),
    totals: {
      runs: runs.length,
      tokens: runs.reduce((sum, run) => sum + run.tokensEstimate, 0),
      cost: runs.reduce((sum, run) => sum + run.costEstimate, 0),
      completed: runs.filter((run) => run.status === "completed").length,
      failed: runs.filter((run) => run.status === "failed").length,
    },
    integrations: integrations.map((integration) => ({
      id: integration.id,
      name: integration.name,
      status: integration.status,
      mode: integration.mode,
      enabled: integration.enabled,
      lastUsed: integration.lastUsed ?? null,
    })),
  });
}
