import { NextResponse } from "next/server";
import { getScheduledCount, reloadScheduler, startScheduler } from "@/lib/scheduler/worker";

export const runtime = "nodejs";

export async function GET() {
  await startScheduler();
  return NextResponse.json({ scheduled: getScheduledCount() });
}

export async function POST() {
  await reloadScheduler();
  return NextResponse.json({ scheduled: getScheduledCount(), reloaded: true });
}
