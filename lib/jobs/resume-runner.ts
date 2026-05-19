/**
 * Job handler: `run.resume_tool` — replays an approved tool call.
 *
 * When the dispatcher gates a tool call, it stores the original args on the
 * approval row's `payload_json`. After the user approves on /approvals, the
 * API enqueues this job. The worker re-dispatches the tool with the original
 * args and `dryRun=false` (already approved), then appends a synthetic
 * TOOL_RESULT marker to the parent run's stored output so the user can see
 * the resumed observation alongside the original transcript.
 */

import { registerJobHandler } from "@/lib/jobs/queue";
import { dispatchTool, type DispatchContext } from "@/lib/tools/dispatcher";
import { getApproval, getRun, updateRun } from "@/lib/db/repositories";
import { emitRunEvent } from "@/lib/agent/event-bus";
import type { GeneratedArtifact, PermissionLevel } from "@/types";

let registered = false;

interface ToolCallPayload {
  kind?: string;
  toolName?: string;
  args?: Record<string, unknown>;
  skillId?: string;
  runId?: string;
  permissionLevel?: PermissionLevel;
}

export function ensureResumeJobHandler() {
  if (registered) return;
  registered = true;
  registerJobHandler("run.resume_tool", async (payload) => {
    const approvalId = typeof payload.approvalId === "string" ? payload.approvalId : undefined;
    if (!approvalId) return;
    const approval = await getApproval(approvalId);
    if (!approval) return;
    if (approval.status !== "approved") return;
    const args = approval.payload as ToolCallPayload | undefined;
    if (!args || args.kind !== "tool_call" || !args.toolName) return;

    const run = await getRun(approval.runId);
    if (!run) return;

    const artifactSink: GeneratedArtifact[] = [];
    const context: DispatchContext = {
      runId: approval.runId,
      skillId: args.skillId,
      permissionLevel: args.permissionLevel ?? "approval-required",
      dryRun: false,
      artifactSink,
    };

    const outcome = await dispatchTool(
      { name: args.toolName, args: args.args ?? {} },
      context,
    );

    const marker = [
      "",
      `## Tool Result (resumed after approval ${approval.id})`,
      `**Tool:** ${args.toolName}`,
      `**Status:** ${outcome.result.ok ? "ok" : "error"}`,
      `**Summary:** ${outcome.result.summary}`,
      outcome.result.data ? "```json\n" + JSON.stringify(outcome.result.data).slice(0, 2000) + "\n```" : "",
    ]
      .filter(Boolean)
      .join("\n");

    run.finalOutput = `${run.finalOutput ?? ""}${marker}`;
    if (artifactSink.length) {
      run.artifacts = [...(run.artifacts ?? []), ...artifactSink];
      for (const a of artifactSink) {
        if (!run.createdArtifacts.includes(a.path)) run.createdArtifacts.push(a.path);
      }
    }
    await updateRun(run);

    emitRunEvent({
      runId: approval.runId,
      type: "run.tool",
      payload: {
        tool: args.toolName,
        action: `resumed:${args.toolName}`,
        status: outcome.result.ok ? "executed" : "failed",
        risk: "medium",
      },
    });
    if (outcome.result.ok) {
      emitRunEvent({
        runId: approval.runId,
        type: "run.output",
        payload: { delta: `\n[resumed ${args.toolName}: ${outcome.result.summary}]` },
      });
    }
  });
}
