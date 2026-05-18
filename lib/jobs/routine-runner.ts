/**
 * Routine job handler. Lets the scheduler hand off long-running routine
 * executions to the durable queue instead of running them inline.
 */

import { registerJobHandler } from "@/lib/jobs/queue";
import { createAndRunWorkflow } from "@/lib/agent/engine";

let registered = false;

export function ensureRoutineJobHandler() {
  if (registered) return;
  registered = true;
  registerJobHandler("routine.run", async (payload) => {
    const skillId = typeof payload.skillId === "string" ? payload.skillId : undefined;
    const prompt = typeof payload.prompt === "string" ? payload.prompt : "Scheduled routine";
    const dryRun = payload.dryRun !== false;
    await createAndRunWorkflow({ prompt, skillId, dryRun });
  });
}
