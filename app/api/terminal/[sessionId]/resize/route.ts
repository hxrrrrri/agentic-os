import { NextResponse } from "next/server";
import { z } from "zod";
import { resizeSession } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.object({
  cols: z.number().int().min(20).max(500),
  rows: z.number().int().min(5).max(200),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = Schema.parse(await request.json());
    resizeSession(sessionId, body.cols, body.rows);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
