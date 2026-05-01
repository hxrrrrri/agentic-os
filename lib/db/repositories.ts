import { getDb, rows, saveDb } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";
import type { AgentPlan, ApprovalRequest, AuditLog, Integration, MemoryItem, Routine, Run, RunStep, ToolCall } from "@/types";

type RunRow = {
  id: string;
  title: string;
  prompt: string;
  selected_skill?: string;
  category: string;
  status: Run["status"];
  started_at: string;
  ended_at?: string;
  duration_ms?: number;
  tokens_estimate: number;
  cost_estimate: number;
  files_touched_json: string;
  errors_json: string;
  final_output?: string;
  created_artifacts_json: string;
};

function parseJson<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function insertRun(run: Run, plan: AgentPlan) {
  const db = await getDb();
  db.run(
    `INSERT INTO runs (id, title, prompt, selected_skill, category, status, started_at, ended_at, duration_ms, tokens_estimate, cost_estimate, plan_json, files_touched_json, errors_json, final_output, created_artifacts_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      run.id,
      run.title,
      run.prompt,
      run.selectedSkill ?? null,
      run.category,
      run.status,
      run.startedAt,
      run.endedAt ?? null,
      run.durationMs ?? null,
      run.tokensEstimate,
      run.costEstimate,
      JSON.stringify(plan),
      JSON.stringify(run.filesTouched),
      JSON.stringify(run.errors),
      run.finalOutput ?? null,
      JSON.stringify(run.createdArtifacts),
    ],
  );
  await saveDb();
}

export async function updateRun(run: Run, plan?: AgentPlan) {
  const db = await getDb();
  db.run(
    `UPDATE runs SET status = ?, ended_at = ?, duration_ms = ?, tokens_estimate = ?, cost_estimate = ?,
       plan_json = COALESCE(?, plan_json), files_touched_json = ?, errors_json = ?, final_output = ?, created_artifacts_json = ?
     WHERE id = ?`,
    [
      run.status,
      run.endedAt ?? null,
      run.durationMs ?? null,
      run.tokensEstimate,
      run.costEstimate,
      plan ? JSON.stringify(plan) : null,
      JSON.stringify(run.filesTouched),
      JSON.stringify(run.errors),
      run.finalOutput ?? null,
      JSON.stringify(run.createdArtifacts),
      run.id,
    ],
  );
  await saveDb();
}

export async function insertRunStep(step: RunStep) {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO run_steps (id, run_id, step_index, title, status, started_at, ended_at, observation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [step.id, step.runId, step.index, step.title, step.status, step.startedAt ?? null, step.endedAt ?? null, step.observation ?? null],
  );
  await saveDb();
}

export async function insertToolCall(toolCall: ToolCall) {
  const db = await getDb();
  db.run(
    `INSERT INTO tool_calls (id, run_id, step_id, tool, action, input, output, risk_level, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      toolCall.id,
      toolCall.runId,
      toolCall.stepId ?? null,
      toolCall.tool,
      toolCall.action,
      toolCall.input,
      toolCall.output ?? null,
      toolCall.riskLevel,
      toolCall.status,
      toolCall.createdAt,
    ],
  );
  await saveDb();
}

export async function insertApproval(approval: ApprovalRequest) {
  const db = await getDb();
  db.run(
    `INSERT INTO approvals (id, run_id, action, integration, affected_resource, command_or_payload, risk_level, explanation, status, created_at, resolved_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      approval.id,
      approval.runId,
      approval.action,
      approval.integration,
      approval.affectedResource,
      approval.commandOrPayload,
      approval.riskLevel,
      approval.explanation,
      approval.status,
      approval.createdAt,
      approval.resolvedAt ?? null,
    ],
  );
  await saveDb();
}

export async function updateApproval(id: string, status: ApprovalRequest["status"]) {
  const db = await getDb();
  db.run("UPDATE approvals SET status = ?, resolved_at = ? WHERE id = ?", [status, nowIso(), id]);
  await saveDb();
}

export async function listRuns(limit = 100): Promise<Run[]> {
  const db = await getDb();
  const runRows = rows<RunRow>(db.exec(`SELECT * FROM runs ORDER BY started_at DESC LIMIT ${Number(limit)}`));
  const ids = runRows.map((run) => run.id);
  const steps = await listSteps(ids);
  const toolCalls = await listToolCalls(ids);
  const approvals = await listApprovals();
  return runRows.map((run) => ({
    id: run.id,
    title: run.title,
    prompt: run.prompt,
    selectedSkill: run.selected_skill ?? undefined,
    category: run.category,
    status: run.status,
    startedAt: run.started_at,
    endedAt: run.ended_at,
    durationMs: run.duration_ms,
    tokensEstimate: run.tokens_estimate,
    costEstimate: run.cost_estimate,
    steps: steps.filter((step) => step.runId === run.id),
    toolCalls: toolCalls.filter((call) => call.runId === run.id),
    approvals: approvals.filter((approval) => approval.runId === run.id).map((approval) => approval.id),
    filesTouched: parseJson<string[]>(run.files_touched_json, []),
    errors: parseJson<string[]>(run.errors_json, []),
    finalOutput: run.final_output,
    createdArtifacts: parseJson<string[]>(run.created_artifacts_json, []),
  }));
}

export async function getRun(id: string) {
  const runs = await listRuns(500);
  return runs.find((run) => run.id === id);
}

export async function getRunPlan(id: string): Promise<AgentPlan | undefined> {
  const db = await getDb();
  const result = rows<{ plan_json: string }>(db.exec("SELECT plan_json FROM runs WHERE id = ?", [id]));
  return parseJson<AgentPlan | undefined>(result[0]?.plan_json, undefined);
}

async function listSteps(runIds: string[]): Promise<RunStep[]> {
  if (!runIds.length) return [];
  const db = await getDb();
  const result = rows<{
    id: string;
    run_id: string;
    step_index: number;
    title: string;
    status: RunStep["status"];
    started_at?: string;
    ended_at?: string;
    observation?: string;
  }>(db.exec("SELECT * FROM run_steps ORDER BY step_index ASC"));
  return result.map((step) => ({
    id: step.id,
    runId: step.run_id,
    index: step.step_index,
    title: step.title,
    status: step.status,
    startedAt: step.started_at,
    endedAt: step.ended_at,
    observation: step.observation,
  }));
}

async function listToolCalls(runIds: string[]): Promise<ToolCall[]> {
  if (!runIds.length) return [];
  const db = await getDb();
  const result = rows<{
    id: string;
    run_id: string;
    step_id?: string;
    tool: string;
    action: string;
    input: string;
    output?: string;
    risk_level: ToolCall["riskLevel"];
    status: ToolCall["status"];
    created_at: string;
  }>(db.exec("SELECT * FROM tool_calls ORDER BY created_at ASC"));
  return result.map((call) => ({
    id: call.id,
    runId: call.run_id,
    stepId: call.step_id,
    tool: call.tool,
    action: call.action,
    input: call.input,
    output: call.output,
    riskLevel: call.risk_level,
    status: call.status,
    createdAt: call.created_at,
  }));
}

export async function listApprovals(status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]> {
  const db = await getDb();
  const query = status ? "SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC" : "SELECT * FROM approvals ORDER BY created_at DESC";
  const result = rows<{
    id: string;
    run_id: string;
    action: string;
    integration: string;
    affected_resource: string;
    command_or_payload: string;
    risk_level: ApprovalRequest["riskLevel"];
    explanation: string;
    status: ApprovalRequest["status"];
    created_at: string;
    resolved_at?: string;
  }>(status ? db.exec(query, [status]) : db.exec(query));
  return result.map((approval) => ({
    id: approval.id,
    runId: approval.run_id,
    action: approval.action,
    integration: approval.integration,
    affectedResource: approval.affected_resource,
    commandOrPayload: approval.command_or_payload,
    riskLevel: approval.risk_level,
    explanation: approval.explanation,
    status: approval.status,
    createdAt: approval.created_at,
    resolvedAt: approval.resolved_at,
  }));
}

export async function listIntegrations(): Promise<Integration[]> {
  const db = await getDb();
  const result = rows<{
    id: string;
    name: string;
    status: Integration["status"];
    mode: Integration["mode"];
    description: string;
    actions_json: string;
    last_used?: string;
    enabled: number;
  }>(db.exec("SELECT * FROM integrations ORDER BY name ASC"));
  return result.map((integration) => ({
    id: integration.id,
    name: integration.name,
    status: integration.status,
    mode: integration.mode,
    description: integration.description,
    actions: parseJson(integration.actions_json, []),
    lastUsed: integration.last_used,
    enabled: Boolean(integration.enabled),
  }));
}

export async function listRoutines(): Promise<Routine[]> {
  const db = await getDb();
  const result = rows<{
    id: string;
    name: string;
    description: string;
    skill_id: string;
    schedule: string;
    trigger_type: Routine["triggerType"];
    enabled: number;
    last_run?: string;
    next_run?: string;
    approval_mode: Routine["approvalMode"];
    output_destination: string;
  }>(db.exec("SELECT * FROM routines ORDER BY enabled DESC, name ASC"));
  return result.map((routine) => ({
    id: routine.id,
    name: routine.name,
    description: routine.description,
    skillId: routine.skill_id,
    schedule: routine.schedule,
    triggerType: routine.trigger_type,
    enabled: Boolean(routine.enabled),
    lastRun: routine.last_run,
    nextRun: routine.next_run,
    approvalMode: routine.approval_mode,
    outputDestination: routine.output_destination,
  }));
}

export async function toggleRoutine(id: string, enabled: boolean) {
  const db = await getDb();
  db.run("UPDATE routines SET enabled = ? WHERE id = ?", [enabled ? 1 : 0, id]);
  await saveDb();
}

export async function touchRoutine(id: string) {
  const db = await getDb();
  db.run("UPDATE routines SET last_run = ? WHERE id = ?", [nowIso(), id]);
  await saveDb();
}

export async function upsertMemoryItem(item: MemoryItem) {
  const db = await getDb();
  db.run(
    `INSERT OR REPLACE INTO memory_index (id, file_path, title, type, tags_json, summary, last_updated, embedding_placeholder, importance_score)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      item.id,
      item.filePath,
      item.title,
      item.type,
      JSON.stringify(item.tags),
      item.summary,
      item.lastUpdated,
      item.embeddingPlaceholder,
      item.importanceScore,
    ],
  );
  await saveDb();
}

export async function listMemoryItems(limit = 100): Promise<MemoryItem[]> {
  const db = await getDb();
  const result = rows<{
    id: string;
    file_path: string;
    title: string;
    type: MemoryItem["type"];
    tags_json: string;
    summary: string;
    last_updated: string;
    embedding_placeholder: string;
    importance_score: number;
  }>(db.exec(`SELECT * FROM memory_index ORDER BY last_updated DESC LIMIT ${Number(limit)}`));
  return result.map((item) => ({
    id: item.id,
    filePath: item.file_path,
    title: item.title,
    type: item.type,
    tags: parseJson(item.tags_json, []),
    summary: item.summary,
    lastUpdated: item.last_updated,
    embeddingPlaceholder: item.embedding_placeholder,
    importanceScore: item.importance_score,
  }));
}

export async function addAuditLog(log: Omit<AuditLog, "id" | "timestamp">) {
  const db = await getDb();
  db.run(
    "INSERT INTO audit_logs (id, timestamp, actor, action, integration, risk_level, result) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [createId("audit"), nowIso(), log.actor, log.action, log.integration ?? null, log.riskLevel, log.result],
  );
  await saveDb();
}
