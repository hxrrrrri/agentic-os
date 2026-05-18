/**
 * Run-level usage meter + budget enforcement.
 *
 * Writes one row per completed run into `usage_meter` (day-bucketed). Budgets
 * live in the `budgets` table keyed by window — `day`, `week`, `month`. A
 * dry-run check (`enforceBudget`) returns `{ allowed, reason }` before each
 * run starts so workflows can short-circuit instead of burning credits.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";

export interface UsageRecord {
  runId?: string;
  skillId?: string;
  provider?: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface Budget {
  id: string;
  window: "day" | "week" | "month";
  maxCostUsd: number;
  maxRuns?: number;
  updatedAt: string;
}

interface BudgetRow {
  id: string;
  window: string;
  max_cost_usd: number;
  max_runs: number | null;
  updated_at: string;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

export async function recordUsage(rec: UsageRecord): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO usage_meter (day, run_id, skill_id, provider, model, input_tokens, output_tokens, cost_usd)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      todayKey(),
      rec.runId ?? null,
      rec.skillId ?? null,
      rec.provider ?? null,
      rec.model ?? null,
      rec.inputTokens,
      rec.outputTokens,
      rec.costUsd,
    ],
  );
  await saveDb();
}

export async function getDayUsage(day = todayKey()): Promise<{ runs: number; cost: number; tokens: number }> {
  const db = await getDb();
  const result = db.exec(
    `SELECT day, COUNT(*) AS runs, SUM(cost_usd) AS cost, SUM(input_tokens + output_tokens) AS tokens
     FROM usage_meter WHERE day = ? GROUP BY day`,
    [day],
  );
  const row = result[0]?.values[0];
  if (!row) return { runs: 0, cost: 0, tokens: 0 };
  return { runs: Number(row[1] ?? 0), cost: Number(row[2] ?? 0), tokens: Number(row[3] ?? 0) };
}

export async function getWindowUsage(days: number): Promise<{ runs: number; cost: number; tokens: number }> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const result = db.exec(
    `SELECT COUNT(*) AS runs, SUM(cost_usd) AS cost, SUM(input_tokens + output_tokens) AS tokens
     FROM usage_meter WHERE day >= ?`,
    [cutoff],
  );
  const row = result[0]?.values[0];
  if (!row) return { runs: 0, cost: 0, tokens: 0 };
  return { runs: Number(row[0] ?? 0), cost: Number(row[1] ?? 0), tokens: Number(row[2] ?? 0) };
}

export async function getRecentUsageDaily(days = 14): Promise<Array<{ day: string; cost: number; runs: number }>> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
  const result = db.exec(
    `SELECT day, SUM(cost_usd) AS cost, COUNT(*) AS runs FROM usage_meter
     WHERE day >= ? GROUP BY day ORDER BY day ASC`,
    [cutoff],
  );
  return rows<{ day: string; cost: number; runs: number }>(result);
}

export async function listBudgets(): Promise<Budget[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, window, max_cost_usd, max_runs, updated_at FROM budgets`);
  return rows<BudgetRow>(result).map((r) => ({
    id: r.id,
    window: r.window as Budget["window"],
    maxCostUsd: r.max_cost_usd,
    maxRuns: r.max_runs ?? undefined,
    updatedAt: r.updated_at,
  }));
}

export async function setBudget(window: Budget["window"], maxCostUsd: number, maxRuns?: number): Promise<void> {
  const db = await getDb();
  const now = new Date().toISOString();
  db.run(
    `INSERT INTO budgets (id, window, max_cost_usd, max_runs, updated_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET max_cost_usd = excluded.max_cost_usd, max_runs = excluded.max_runs, updated_at = excluded.updated_at`,
    [window, window, maxCostUsd, maxRuns ?? null, now],
  );
  await saveDb();
}

export async function enforceBudget(): Promise<{ allowed: true } | { allowed: false; reason: string }> {
  const budgets = await listBudgets();
  for (const budget of budgets) {
    const days = budget.window === "day" ? 1 : budget.window === "week" ? 7 : 30;
    const usage = await getWindowUsage(days);
    if (usage.cost >= budget.maxCostUsd) {
      return { allowed: false, reason: `${budget.window} cost cap of $${budget.maxCostUsd.toFixed(2)} hit (used $${usage.cost.toFixed(4)})` };
    }
    if (budget.maxRuns && usage.runs >= budget.maxRuns) {
      return { allowed: false, reason: `${budget.window} run cap of ${budget.maxRuns} hit` };
    }
  }
  return { allowed: true };
}
