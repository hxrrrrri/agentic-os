/**
 * In-memory pub/sub for run events. Replaces /api/runs/[id]/stream's polling.
 *
 * Engine code calls `emitRunEvent({ runId, type, payload })`; clients subscribe
 * via `subscribeToRun(runId, handler)` (returns an unsubscribe function) or
 * via the SSE endpoint at /api/runs/[id]/events. Buffered ring keeps the last
 * 500 events per run so a late subscriber gets backfill.
 */

export type RunEventType =
  | "run.started"
  | "run.status"
  | "run.step"
  | "run.tool"
  | "run.approval"
  | "run.artifact"
  | "run.log"
  | "run.output"
  | "run.completed"
  | "run.failed";

export interface RunEvent {
  runId: string;
  type: RunEventType;
  at: string;
  payload: Record<string, unknown>;
}

type Handler = (event: RunEvent) => void;

type RunEventGlobal = typeof globalThis & {
  __agenticosRunSubscribers?: Map<string, Set<Handler>>;
  __agenticosRunGlobalSubscribers?: Set<Handler>;
  __agenticosRunBuffers?: Map<string, RunEvent[]>;
};

const runEventGlobal = globalThis as RunEventGlobal;
const subscribers = runEventGlobal.__agenticosRunSubscribers ?? new Map<string, Set<Handler>>();
const globalSubscribers = runEventGlobal.__agenticosRunGlobalSubscribers ?? new Set<Handler>();
const buffers = runEventGlobal.__agenticosRunBuffers ?? new Map<string, RunEvent[]>();
runEventGlobal.__agenticosRunSubscribers = subscribers;
runEventGlobal.__agenticosRunGlobalSubscribers = globalSubscribers;
runEventGlobal.__agenticosRunBuffers = buffers;
const BUFFER_LIMIT = 500;

export function emitRunEvent(event: Omit<RunEvent, "at"> & { at?: string }) {
  const full: RunEvent = { ...event, at: event.at ?? new Date().toISOString() };

  let buffer = buffers.get(full.runId);
  if (!buffer) {
    buffer = [];
    buffers.set(full.runId, buffer);
  }
  buffer.push(full);
  if (buffer.length > BUFFER_LIMIT) buffer.splice(0, buffer.length - BUFFER_LIMIT);

  const runSubs = subscribers.get(full.runId);
  if (runSubs) for (const h of runSubs) h(full);
  for (const h of globalSubscribers) h(full);
}

export function subscribeToRun(runId: string, handler: Handler): () => void {
  let set = subscribers.get(runId);
  if (!set) {
    set = new Set();
    subscribers.set(runId, set);
  }
  set.add(handler);
  return () => {
    set?.delete(handler);
    if (set && set.size === 0) subscribers.delete(runId);
  };
}

export function subscribeAll(handler: Handler): () => void {
  globalSubscribers.add(handler);
  return () => globalSubscribers.delete(handler);
}

export function getRunBuffer(runId: string): RunEvent[] {
  return buffers.get(runId) ?? [];
}

export function clearRunBuffer(runId: string) {
  buffers.delete(runId);
}
