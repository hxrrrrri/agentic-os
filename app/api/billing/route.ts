import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getDayUsage,
  getRecentUsageDaily,
  getWindowUsage,
  listBudgets,
  setBudget,
} from "@/lib/billing/meter";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BudgetSchema = z.object({
  window: z.enum(["day", "week", "month"]),
  maxCostUsd: z.number().min(0),
  maxRuns: z.number().int().min(0).optional(),
});

export async function GET() {
  const [today, week, month, daily, budgets] = await Promise.all([
    getDayUsage(),
    getWindowUsage(7),
    getWindowUsage(30),
    getRecentUsageDaily(14),
    listBudgets(),
  ]);
  return NextResponse.json({ today, week, month, daily, budgets });
}

export async function PUT(request: Request) {
  try {
    const body = BudgetSchema.parse(await request.json());
    await setBudget(body.window, body.maxCostUsd, body.maxRuns);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
