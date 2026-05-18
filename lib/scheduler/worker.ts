import cron, { ScheduledTask } from "node-cron";
import { listRoutines, touchRoutine, addAuditLog } from "@/lib/db/repositories";
import { enqueueJob, startJobWorker } from "@/lib/jobs/queue";
import { ensureRoutineJobHandler } from "@/lib/jobs/routine-runner";
import { ensureGradeJobHandler } from "@/lib/jobs/grade-runner";
import type { Routine } from "@/types";

const tasks = new Map<string, ScheduledTask>();
let started = false;

function naturalToCron(schedule: string): string | null {
  const s = schedule.toLowerCase().trim();
  const timeMatch = s.match(/(\d{1,2}):(\d{2})/);
  const hour = timeMatch ? parseInt(timeMatch[1], 10) : 9;
  const minute = timeMatch ? parseInt(timeMatch[2], 10) : 0;

  if (/^every\s+(day|24h|daily)/.test(s) || s.includes("every day")) {
    return `${minute} ${hour} * * *`;
  }
  if (s.includes("weekday")) return `${minute} ${hour} * * 1-5`;
  if (s.includes("monday")) return `${minute} ${hour} * * 1`;
  if (s.includes("tuesday")) return `${minute} ${hour} * * 2`;
  if (s.includes("wednesday")) return `${minute} ${hour} * * 3`;
  if (s.includes("thursday")) return `${minute} ${hour} * * 4`;
  if (s.includes("friday")) return `${minute} ${hour} * * 5`;
  if (s.includes("saturday")) return `${minute} ${hour} * * 6`;
  if (s.includes("sunday")) return `${minute} ${hour} * * 0`;
  if (/^\d/.test(s) && /\d \d/.test(s) && s.split(/\s+/).length >= 5) return s;
  return null;
}

async function fireRoutine(routine: Routine) {
  try {
    await addAuditLog({
      actor: "scheduler",
      action: `enqueued routine: ${routine.name}`,
      integration: "agenticos",
      riskLevel: "low",
      result: "completed",
    });
    await enqueueJob("routine.run", {
      routineId: routine.id,
      skillId: routine.skillId,
      prompt: `Scheduled routine: ${routine.name}. ${routine.description}`,
      dryRun: routine.approvalMode !== "auto",
    });
    await touchRoutine(routine.id);
  } catch (error) {
    await addAuditLog({
      actor: "scheduler",
      action: `routine enqueue failed: ${routine.name} — ${error instanceof Error ? error.message : "unknown"}`,
      integration: "agenticos",
      riskLevel: "medium",
      result: "failed",
    });
  }
}

function scheduleRoutine(routine: Routine) {
  const existing = tasks.get(routine.id);
  if (existing) {
    existing.stop();
    tasks.delete(routine.id);
  }
  if (!routine.enabled) return;
  const expr = naturalToCron(routine.schedule);
  if (!expr || !cron.validate(expr)) return;
  const task = cron.schedule(expr, () => void fireRoutine(routine), { timezone: process.env.TZ });
  tasks.set(routine.id, task);
}

export async function startScheduler() {
  if (started) return;
  started = true;
  ensureRoutineJobHandler();
  ensureGradeJobHandler();
  startJobWorker();
  const routines = await listRoutines();
  routines.forEach(scheduleRoutine);
}

export async function reloadScheduler() {
  tasks.forEach((task) => task.stop());
  tasks.clear();
  started = false;
  await startScheduler();
}

export function getScheduledCount() {
  return tasks.size;
}
