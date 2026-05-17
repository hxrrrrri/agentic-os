import { NextResponse } from "next/server";
import { z } from "zod";
import { startRun } from "@/lib/agent/engine";
import { listRuns } from "@/lib/db/repositories";

export const runtime = "nodejs";
export const maxDuration = 300;

const RunRequestSchema = z.object({
  prompt: z.string().min(1),
  skillId: z.string().optional(),
  dryRun: z.boolean().optional(),
  useSwarm: z.boolean().optional(),
  modelProfile: z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    thinking: z.enum(["off", "think", "think-hard", "think-harder", "ultrathink"]).optional(),
    reasoningEffort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
  }).optional(),
});

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = RunRequestSchema.parse(await request.json());
    // startRun creates the DB record immediately and processes the model call in background.
    // This prevents HTTP timeouts on long model runs while still returning a navigable run ID.
    const run = await startRun(body);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create run" },
      { status: 400 },
    );
  }
}
