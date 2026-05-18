import { NextResponse } from "next/server";
import { getRecentUsageDaily, getWindowUsage, listBudgets } from "@/lib/billing/meter";
import { cacheStats, clearCache } from "@/lib/billing/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [daily14, last7, last30, budgets, cache] = await Promise.all([
    getRecentUsageDaily(14),
    getWindowUsage(7),
    getWindowUsage(30),
    listBudgets(),
    cacheStats(),
  ]);

  const avgDailyCost = last7.cost / 7;
  const forecast30 = avgDailyCost * 30;
  const forecast90 = avgDailyCost * 90;

  return NextResponse.json({
    daily14,
    last7,
    last30,
    budgets,
    cache,
    forecast: { avgDailyCost, forecast30, forecast90 },
  });
}

export async function DELETE() {
  const removed = await clearCache();
  return NextResponse.json({ ok: true, removed });
}
