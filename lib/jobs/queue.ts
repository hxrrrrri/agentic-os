/**
 * SQLite-backed durable job queue.
 *
 * Persists across restarts (unlike the in-memory scheduler) — at startup the
 * worker picks up any pending jobs whose run_after is in the past.
 *
 * Workers register handlers keyed by `kind`. Each handler returns void on
 * success or throws to retry. Exponential backoff: 30s × 2^attempt.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  kind: string;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

interface JobRow {
  id: string;
  kind: string;
  payload_json: string;
  status: JobStatus;
  attempts: number;
  max_attempts: number;
  run_after: string;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  error: string | null;
}

function rowToJob(r: JobRow): Job {
  return {
    id: r.id,
    kind: r.kind,
    payload: JSON.parse(r.payload_json),
    status: r.status,
    attempts: r.attempts,
    maxAttempts: r.max_attempts,
    runAfter: r.run_after,
    createdAt: r.created_at,
    startedAt: r.started_at ?? undefined,
    completedAt: r.completed_at ?? undefined,
    error: r.error ?? undefined,
  };
}

export async function enqueueJob(
  kind: string,
  payload: Record<string, unknown>,
  options: { runAfter?: Date; maxAttempts?: number } = {},
): Promise<string> {
  const db = await getDb();
  const id = createId("job");
  db.run(
    `INSERT INTO jobs (id, kind, payload_json, status, attempts, max_attempts, run_after, created_at)
     VALUES (?, ?, ?, 'pending', 0, ?, ?, ?)`,
    [
      id,
      kind,
      JSON.stringify(payload),
      options.maxAttempts ?? 3,
      (options.runAfter ?? new Date()).toISOString(),
      nowIso(),
    ],
  );
  await saveDb();
  return id;
}

export async function listJobs(limit = 100): Promise<Job[]> {
  const db = await getDb();
  const result = db.exec(
    `SELECT id, kind, payload_json, status, attempts, max_attempts, run_after, created_at, started_at, completed_at, error
     FROM jobs ORDER BY created_at DESC LIMIT ${Number(limit) || 100}`,
  );
  return rows<JobRow>(result).map(rowToJob);
}

async function claimNext(): Promise<Job | null> {
  const db = await getDb();
  const now = nowIso();
  const result = db.exec(
    `SELECT id, kind, payload_json, status, attempts, max_attempts, run_after, created_at, started_at, completed_at, error
     FROM jobs
     WHERE status = 'pending' AND run_after <= '${now.replaceAll("'", "''")}'
     ORDER BY run_after ASC LIMIT 1`,
  );
  const job = rows<JobRow>(result)[0];
  if (!job) return null;
  db.run(`UPDATE jobs SET status = 'running', started_at = ?, attempts = attempts + 1 WHERE id = ?`, [now, job.id]);
  await saveDb();
  return rowToJob({ ...job, status: "running", attempts: job.attempts + 1, started_at: now });
}

async function markCompleted(id: string) {
  const db = await getDb();
  db.run(`UPDATE jobs SET status = 'completed', completed_at = ?, error = NULL WHERE id = ?`, [nowIso(), id]);
  await saveDb();
}

async function markFailedOrRetry(job: Job, err: unknown) {
  const db = await getDb();
  const errorMsg = err instanceof Error ? err.message : String(err);
  if (job.attempts >= job.maxAttempts) {
    db.run(`UPDATE jobs SET status = 'failed', completed_at = ?, error = ? WHERE id = ?`, [nowIso(), errorMsg, job.id]);
  } else {
    const backoffMs = 30_000 * 2 ** (job.attempts - 1);
    const next = new Date(Date.now() + backoffMs).toISOString();
    db.run(`UPDATE jobs SET status = 'pending', run_after = ?, error = ? WHERE id = ?`, [next, errorMsg, job.id]);
  }
  await saveDb();
}

type Handler = (payload: Record<string, unknown>, job: Job) => Promise<void>;
const handlers = new Map<string, Handler>();

export function registerJobHandler(kind: string, handler: Handler) {
  handlers.set(kind, handler);
}

let workerStarted = false;
let workerTimer: ReturnType<typeof setInterval> | null = null;

async function tick() {
  try {
    let job = await claimNext();
    let drained = 0;
    while (job && drained < 5) {
      const handler = handlers.get(job.kind);
      if (!handler) {
        await markFailedOrRetry(job, new Error(`No handler for job kind '${job.kind}'`));
      } else {
        try {
          await handler(job.payload, job);
          await markCompleted(job.id);
        } catch (err) {
          await markFailedOrRetry(job, err);
        }
      }
      drained++;
      job = await claimNext();
    }
  } catch {
    // never throw from tick
  }
}

export function startJobWorker() {
  if (workerStarted) return;
  workerStarted = true;
  // Kick off immediately and then poll every 5s.
  void tick();
  workerTimer = setInterval(() => void tick(), 5_000);
}

export function stopJobWorker() {
  if (workerTimer) clearInterval(workerTimer);
  workerTimer = null;
  workerStarted = false;
}
