import { NextResponse } from "next/server";
import { z } from "zod";
import { createAndRunWorkflow } from "@/lib/agent/engine";
import { listRuns } from "@/lib/db/repositories";

export const runtime = "nodejs";

const RunRequestSchema = z.object({
  prompt: z.string().min(1),
  skillId: z.string().optional(),
  dryRun: z.boolean().optional(),
});

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = RunRequestSchema.parse(await request.json());
    const run = await createAndRunWorkflow(body);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create run" },
      { status: 400 },
    );
  }
}
