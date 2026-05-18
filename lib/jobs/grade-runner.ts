/**
 * Job handler: `run.grade` — auto-grades a completed run and triggers skill
 * distillation when a skill accumulates enough high-quality runs.
 */

import { registerJobHandler } from "@/lib/jobs/queue";
import { gradeRun } from "@/lib/skills/auto-grade";

let registered = false;

export function ensureGradeJobHandler() {
  if (registered) return;
  registered = true;
  registerJobHandler("run.grade", async (payload) => {
    const runId = typeof payload.runId === "string" ? payload.runId : undefined;
    if (!runId) return;
    await gradeRun(runId).catch(() => {});
  });
}
