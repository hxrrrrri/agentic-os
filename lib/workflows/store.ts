/**
 * Workflow store — a DAG of skill nodes that can be triggered manually, on a
 * schedule, or by webhook. Executor runs nodes in topological order; each
 * node's `inputs` map can reference upstream `${nodeId.output}` placeholders.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";

export type NodeKind = "trigger" | "skill" | "condition" | "output";

export interface WorkflowNode {
  id: string;
  kind: NodeKind;
  label: string;
  skillId?: string;
  config?: Record<string, unknown>;
  // For condition: { expression: "${nodeId.output} contains 'success'" }
}

export interface WorkflowEdge {
  from: string;
  to: string;
  branch?: "true" | "false";
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  enabled: boolean;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  createdAt: string;
  updatedAt: string;
}

interface WorkflowRow {
  id: string;
  name: string;
  description: string | null;
  nodes_json: string;
  edges_json: string;
  trigger: string | null;
  enabled: number;
  created_at: string;
  updated_at: string;
}

function rowToWorkflow(r: WorkflowRow): Workflow {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? undefined,
    nodes: JSON.parse(r.nodes_json) as WorkflowNode[],
    edges: JSON.parse(r.edges_json) as WorkflowEdge[],
    trigger: r.trigger ?? undefined,
    enabled: Boolean(r.enabled),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export async function listWorkflows(): Promise<Workflow[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, description, nodes_json, edges_json, trigger, enabled, created_at, updated_at FROM workflows ORDER BY updated_at DESC`);
  return rows<WorkflowRow>(result).map(rowToWorkflow);
}

export async function getWorkflow(id: string): Promise<Workflow | null> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, description, nodes_json, edges_json, trigger, enabled, created_at, updated_at FROM workflows WHERE id = ?`, [id]);
  const row = rows<WorkflowRow>(result)[0];
  return row ? rowToWorkflow(row) : null;
}

export async function upsertWorkflow(wf: Partial<Workflow> & { name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[] }): Promise<Workflow> {
  const db = await getDb();
  const now = nowIso();
  const id = wf.id ?? createId("wf");
  const existing = wf.id ? await getWorkflow(wf.id) : null;
  const created = existing?.createdAt ?? now;
  db.run(
    `INSERT INTO workflows (id, name, description, nodes_json, edges_json, trigger, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       nodes_json = excluded.nodes_json,
       edges_json = excluded.edges_json,
       trigger = excluded.trigger,
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
    [
      id,
      wf.name,
      wf.description ?? null,
      JSON.stringify(wf.nodes),
      JSON.stringify(wf.edges),
      wf.trigger ?? null,
      wf.enabled === false ? 0 : 1,
      created,
      now,
    ],
  );
  await saveDb();
  return (await getWorkflow(id))!;
}

export async function deleteWorkflow(id: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM workflows WHERE id = ?`, [id]);
  await saveDb();
}

/** Topologically order nodes; throws if there's a cycle. */
export function topologicalOrder(workflow: Workflow): WorkflowNode[] {
  const incoming = new Map<string, Set<string>>();
  for (const n of workflow.nodes) incoming.set(n.id, new Set());
  for (const e of workflow.edges) incoming.get(e.to)?.add(e.from);

  const ordered: WorkflowNode[] = [];
  const ready = workflow.nodes.filter((n) => (incoming.get(n.id)?.size ?? 0) === 0);
  while (ready.length) {
    const next = ready.shift()!;
    ordered.push(next);
    for (const e of workflow.edges) {
      if (e.from !== next.id) continue;
      const inc = incoming.get(e.to)!;
      inc.delete(next.id);
      if (inc.size === 0) {
        const node = workflow.nodes.find((n) => n.id === e.to);
        if (node && !ordered.includes(node)) ready.push(node);
      }
    }
  }
  if (ordered.length !== workflow.nodes.length) throw new Error("Workflow has a cycle");
  return ordered;
}

export interface RunWorkflowResult {
  workflowId: string;
  steps: Array<{ nodeId: string; runId?: string; output?: string; skipped?: boolean; error?: string }>;
}

export async function executeWorkflow(workflowId: string, initialPrompt?: string): Promise<RunWorkflowResult> {
  const wf = await getWorkflow(workflowId);
  if (!wf) throw new Error("Workflow not found");
  if (!wf.enabled) throw new Error("Workflow disabled");
  const order = topologicalOrder(wf);
  const outputs = new Map<string, string>();
  const steps: RunWorkflowResult["steps"] = [];

  // Lazy-import the engine to avoid a circular module cycle at file load time.
  const { startRun } = await import("@/lib/agent/engine");

  for (const node of order) {
    if (node.kind === "trigger") {
      outputs.set(node.id, initialPrompt ?? (node.config?.prompt as string | undefined) ?? "");
      steps.push({ nodeId: node.id, output: outputs.get(node.id) });
      continue;
    }
    if (node.kind === "condition") {
      const expr = String(node.config?.expression ?? "");
      const resolved = interpolate(expr, outputs);
      const truthy = Boolean(resolved && resolved !== "false" && resolved !== "0");
      outputs.set(node.id, truthy ? "true" : "false");
      steps.push({ nodeId: node.id, output: outputs.get(node.id) });
      continue;
    }
    if (node.kind === "output") {
      steps.push({ nodeId: node.id, output: interpolate(String(node.config?.template ?? ""), outputs) });
      continue;
    }
    // skill
    const promptTemplate = (node.config?.prompt as string | undefined) ?? "";
    const prompt = interpolate(promptTemplate, outputs);
    try {
      const run = await startRun({ prompt, skillId: node.skillId, dryRun: true });
      outputs.set(node.id, `run:${run.id}`);
      steps.push({ nodeId: node.id, runId: run.id });
    } catch (err) {
      steps.push({ nodeId: node.id, error: err instanceof Error ? err.message : "node failed" });
    }
  }

  return { workflowId, steps };
}

function interpolate(template: string, outputs: Map<string, string>): string {
  return template.replace(/\$\{(\w+)(?:\.output)?\}/g, (_match, nodeId: string) => outputs.get(nodeId) ?? "");
}
