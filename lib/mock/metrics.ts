import type { Run } from "@/types";

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
  const today = new Date().toISOString().slice(0, 10);
  const todayRuns = runs.filter((run) => run.startedAt.startsWith(today));
  const tokens = todayRuns.reduce((sum, run) => sum + run.tokensEstimate, 0);
  const completed = todayRuns.filter((run) => run.status === "completed").length;
  return {
    fiveHour: {
      used: tokens || 48_200,
      max: 200_000,
      sessions: Math.max(todayRuns.length, 4),
      reset: "03:12",
    },
    weekly: {
      used: runs.reduce((sum, run) => sum + Math.max(1, Math.round((run.durationMs ?? 90_000) / 60_000)), 0) || 284,
      max: 1_200,
      sessions: Math.max(runs.length, 18),
    },
    routines: {
      completed: Math.max(completed, 7),
      max: 25,
      value: "$1,840",
    },
  };
}
