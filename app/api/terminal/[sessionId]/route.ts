import { NextResponse } from "next/server";
import { getSession, killSession } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  const session = getSession(sessionId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({
    id: session.id,
    cliId: session.cliId,
    cliLabel: session.cliLabel,
    alive: session.alive,
    startedAt: session.startedAt,
    historySize: session.history.length,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await params;
  killSession(sessionId);
  return NextResponse.json({ ok: true });
}
