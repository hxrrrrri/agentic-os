import { NextResponse } from "next/server";
import { z } from "zod";
import { CLI_ADAPTERS, getAdapterStatus } from "@/lib/terminal/adapters";
import { createSession, killAllSessions, listSessions } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const adapters = await Promise.all(CLI_ADAPTERS.map(getAdapterStatus));
  return NextResponse.json({ sessions: listSessions(), adapters });
}

const CreateSchema = z.object({
  cliId: z.string().min(1),
  cols: z.number().int().min(20).max(500).optional(),
  rows: z.number().int().min(5).max(200).optional(),
});

export async function POST(request: Request) {
  try {
    const body = CreateSchema.parse(await request.json());
    const session = await createSession(body.cliId, { cols: body.cols, rows: body.rows });
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create session" },
      { status: 400 },
    );
  }
}

export async function DELETE() {
  killAllSessions();
  return NextResponse.json({ ok: true });
}
