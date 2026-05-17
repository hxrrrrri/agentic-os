import { NextResponse } from "next/server";
import { z } from "zod";
import { CLI_ADAPTERS, getAdapterStatus } from "@/lib/terminal/adapters";
import { createSession, listSessions } from "@/lib/terminal/manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const adapters = await Promise.all(CLI_ADAPTERS.map(getAdapterStatus));
  return NextResponse.json({ sessions: listSessions(), adapters });
}

const CreateSchema = z.object({ cliId: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = CreateSchema.parse(await request.json());
    const session = await createSession(body.cliId);
    return NextResponse.json({ session }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create session" },
      { status: 400 },
    );
  }
}
