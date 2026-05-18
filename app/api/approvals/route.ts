import { NextResponse } from "next/server";
import { z } from "zod";
import { getApproval, getRun, listApprovals, updateApproval, updateRun } from "@/lib/db/repositories";
import { executeApproval } from "@/lib/approvals/executors";
import { emitRunEvent } from "@/lib/agent/event-bus";
import { nowIso } from "@/lib/utils";
import type { Run } from "@/types";

export const runtime = "nodejs";

const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(["approved", "rejected"]),
});

export async function GET() {
  const approvals = await listApprovals();
  return NextResponse.json({ approvals });
}

export async function PATCH(request: Request) {
  const body = PatchSchema.parse(await request.json());
  await updateApproval(body.id, body.status);

  let executed: unknown = undefined;
  let executionError: string | undefined;
  const approval = await getApproval(body.id);
  if (body.status === "approved" && approval) {
    const result = await executeApproval({ ...approval, status: "approved" });
    if (result.ok) executed = result.result;
    else executionError = result.error;
  }

  // Resume the parent run when all of its approvals have been resolved.
  // Without this the workflow stays in `waiting_for_approval` forever (this
  // gap was flagged in CLAUDE.md).
  if (approval?.runId) {
    const run = await getRun(approval.runId);
    if (run && run.status === "waiting_for_approval") {
      const open = (await listApprovals("pending")).some((a) => a.runId === run.id);
      if (!open) {
        const finalStatus: Run["status"] = body.status === "approved" ? "completed" : "failed";
        run.status = finalStatus;
        run.endedAt = nowIso();
        run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
        if (finalStatus === "failed" && !run.errors.length) {
          run.errors = ["approval rejected"];
        }
        await updateRun(run);
        emitRunEvent({
          runId: run.id,
          type: finalStatus === "completed" ? "run.completed" : "run.failed",
          payload: {
            status: finalStatus,
            via: "approval-resume",
            approvalId: approval.id,
          },
        });
      }
    }
  }

  return NextResponse.json({
    approvals: await listApprovals(),
    executed,
    executionError,
  });
}
