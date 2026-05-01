import { NextResponse } from "next/server";
import { getRun } from "@/lib/db/repositories";
import { replayRun } from "@/lib/agent/engine";

export const runtime = "nodejs";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const original = await getRun(id);
  if (!original) return NextResponse.json({ error: "Run not found" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as { prompt?: string };
  const run = await replayRun(original, body.prompt);
  return NextResponse.json({ run }, { status: 201 });
}
