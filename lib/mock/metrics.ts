import type { Run } from "@/types";
import { agenticosConfig } from "@/agenticos.config";

export function buildActivitySeries(runs: Run[]) {
  const today = new Date();
  const buckets = new Map<string, number>();
  for (let i = 29; i >= 0; i -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    buckets.set(date.toISOString().slice(0, 10), 0);
  }
  runs.forEach((run) => {
    const key = run.startedAt.slice(0, 10);
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1);
  });
  let total = 0;
  return Array.from(buckets.entries()).map(([date, count]) => {
    total += count;
    return { date: date.slice(5), runs: total, daily: count };
  });
}

export function lastSevenDays(runs: Run[]) {
  return buildActivitySeries(runs).slice(-7).map((point) => ({ day: point.date, runs: point.daily }));
}

export function usageMetrics(runs: Run[]) {
  const now = Date.now();
  const fiveHoursAgo = now - 5 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const today = new Date().toISOString().slice(0, 10);

  const fiveHourRuns = runs.filter((run) => new Date(run.startedAt).getTime() >= fiveHoursAgo);
  const weeklyRuns = runs.filter((run) => new Date(run.startedAt).getTime() >= weekAgo);
  const todayRuns = runs.filter((run) => run.startedAt.startsWith(today));
  const fiveHourTokens = fiveHourRuns.reduce((sum, run) => sum + run.tokensEstimate, 0);
  const weeklyMinutes = weeklyRuns.reduce((sum, run) => sum + Math.max(0, Math.round((run.durationMs ?? 0) / 60_000)), 0);
  const completed = todayRuns.filter((run) => run.status === "completed").length;

  return {
    fiveHour: {
      used: fiveHourTokens,
      max: agenticosConfig.budgets.fiveHourTokens,
      sessions: fiveHourRuns.length,
      reset: new Date(fiveHoursAgo + 10 * 60 * 60 * 1000).toISOString(),
    },
    weekly: {
      used: weeklyMinutes,
      max: agenticosConfig.budgets.weeklyMinutes,
      sessions: weeklyRuns.length,
    },
    routines: {
      completed,
      max: agenticosConfig.budgets.dailyRoutines,
      value: `${todayRuns.length} run${todayRuns.length === 1 ? "" : "s"} today`,
    },
  };
}
