import { NextResponse } from "next/server";
import { getRun, getRunPlan } from "@/lib/db/repositories";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const plan = await getRunPlan(id);
  return NextResponse.json({ run, plan });
}
