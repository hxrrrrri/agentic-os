import { NextResponse } from "next/server";
import { z } from "zod";
import { sendInput, sendRaw } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.union([
  z.object({ data: z.string() }),         // raw keystrokes (xterm.js onData)
  z.object({ line: z.string() }),         // line mode (plain text input)
]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> },
) {
  try {
    const { sessionId } = await params;
    const body = Schema.parse(await request.json());
    if ("data" in body) {
      sendRaw(sessionId, body.data);
    } else {
      sendInput(sessionId, body.line);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 400 },
    );
  }
}
