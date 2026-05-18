/**
 * Browser trace recorder + compiler.
 *
 * Traces are recorded by the browser-side capture script (a bookmarklet or
 * Playwright codegen export). They land here as JSON and we either:
 *   1. Store them for later replay via the existing playwright-local adapter
 *   2. Compile them into a reusable Skill prompt that a model can re-execute
 *      via the headless browser tool.
 *
 * Trace shape (kept loose so multiple capture sources work):
 *   { startUrl, steps: [{ type: "click"|"fill"|"navigate"|"wait", selector?, value? }] }
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";

export type TraceStepType = "click" | "fill" | "navigate" | "wait" | "select" | "press" | "extract";

export interface TraceStep {
  type: TraceStepType;
  selector?: string;
  value?: string;
  url?: string;
  description?: string;
}

export interface BrowserTrace {
  id: string;
  name: string;
  startUrl?: string;
  steps: TraceStep[];
  createdAt: string;
  compiledSkillId?: string;
}

interface TraceRow {
  id: string;
  name: string;
  start_url: string | null;
  steps_json: string;
  created_at: string;
  compiled_skill_id: string | null;
}

function rowToTrace(r: TraceRow): BrowserTrace {
  return {
    id: r.id,
    name: r.name,
    startUrl: r.start_url ?? undefined,
    steps: JSON.parse(r.steps_json) as TraceStep[],
    createdAt: r.created_at,
    compiledSkillId: r.compiled_skill_id ?? undefined,
  };
}

export async function saveTrace(name: string, startUrl: string | undefined, steps: TraceStep[]): Promise<BrowserTrace> {
  const db = await getDb();
  const id = createId("trace");
  const now = nowIso();
  db.run(
    `INSERT INTO browser_traces (id, name, start_url, steps_json, created_at) VALUES (?, ?, ?, ?, ?)`,
    [id, name, startUrl ?? null, JSON.stringify(steps), now],
  );
  await saveDb();
  return { id, name, startUrl, steps, createdAt: now };
}

export async function listTraces(): Promise<BrowserTrace[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, start_url, steps_json, created_at, compiled_skill_id FROM browser_traces ORDER BY created_at DESC LIMIT 100`);
  return rows<TraceRow>(result).map(rowToTrace);
}

export async function getTrace(id: string): Promise<BrowserTrace | null> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, start_url, steps_json, created_at, compiled_skill_id FROM browser_traces WHERE id = ?`, [id]);
  const r = rows<TraceRow>(result)[0];
  return r ? rowToTrace(r) : null;
}

export async function deleteTrace(id: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM browser_traces WHERE id = ?`, [id]);
  await saveDb();
}

/** Compile a trace into a markdown skill description that a model can re-execute via tools. */
export function compileTraceToSkillPrompt(trace: BrowserTrace): string {
  const lines: string[] = [
    `# Skill: ${trace.name}`,
    "",
    "## Recorded browser flow",
    trace.startUrl ? `Start URL: ${trace.startUrl}` : "",
    "",
    "## Steps",
    ...trace.steps.map((step, i) => {
      switch (step.type) {
        case "navigate": return `${i + 1}. Navigate to \`${step.url ?? step.value ?? ""}\``;
        case "click":    return `${i + 1}. Click \`${step.selector ?? ""}\` ${step.description ? `(${step.description})` : ""}`.trim();
        case "fill":     return `${i + 1}. Fill \`${step.selector ?? ""}\` with \`${step.value ?? ""}\``;
        case "select":   return `${i + 1}. Select \`${step.value ?? ""}\` in \`${step.selector ?? ""}\``;
        case "press":    return `${i + 1}. Press \`${step.value ?? ""}\` ${step.selector ? `on \`${step.selector}\`` : ""}`.trim();
        case "wait":     return `${i + 1}. Wait for \`${step.selector ?? step.value ?? "load"}\``;
        case "extract":  return `${i + 1}. Extract \`${step.selector ?? ""}\` as \`${step.description ?? "result"}\``;
      }
    }),
    "",
    "## Replay contract",
    "When invoked, execute the steps above via the browser tool. Halt on any selector that fails to resolve and report the failed step.",
  ];
  return lines.filter(Boolean).join("\n");
}

export async function markCompiled(traceId: string, skillId: string): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE browser_traces SET compiled_skill_id = ? WHERE id = ?`, [skillId, traceId]);
  await saveDb();
}
