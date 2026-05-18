import { NextResponse } from "next/server";
import { z } from "zod";
import { invokeTool } from "@/lib/agent/tool-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const Schema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional().default({}),
});

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const result = await invokeTool(body.name, body.arguments);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
