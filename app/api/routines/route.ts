import { NextResponse } from "next/server";
import { z } from "zod";
import { getRoutineOverview, setRoutineEnabled } from "@/lib/scheduler/routines";
import { listRoutines, touchRoutine } from "@/lib/db/repositories";
import { createAndRunWorkflow } from "@/lib/agent/engine";

export const runtime = "nodejs";

const PatchSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  runNow: z.boolean().optional(),
});

export async function GET() {
  return NextResponse.json(await getRoutineOverview());
}

export async function PATCH(request: Request) {
  const body = PatchSchema.parse(await request.json());
  if (typeof body.enabled === "boolean") await setRoutineEnabled(body.id, body.enabled);
  if (body.runNow) {
    const routine = (await listRoutines()).find((item) => item.id === body.id);
    if (!routine) return NextResponse.json({ error: "Routine not found" }, { status: 404 });
    const run = await createAndRunWorkflow({
      prompt: `Run routine: ${routine.name}. ${routine.description}`,
      skillId: routine.skillId,
      dryRun: routine.approvalMode !== "auto",
    });
    await touchRoutine(routine.id);
    return NextResponse.json({ run });
  }
  return NextResponse.json(await getRoutineOverview());
}
