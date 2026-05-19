import { getDb, rows, saveDb } from "@/lib/db/client";
import { agenticosConfig } from "@/agenticos.config";
import { createId, nowIso } from "@/lib/utils";
import type { AgentPlan, ApprovalRequest, AuditLog, GeneratedArtifact, Integration, MemoryItem, Routine, Run, RunStep, ToolCall } from "@/types";

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
  error_detail?: string;
  artifacts_json?: string;
};

function parseJson<T>(value: string | undefined | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function applyRuntimeIntegrationState(integration: Integration): Integration {
  const env = process.env;
  const configured: Record<string, boolean> = {
    github: Boolean(env.GITHUB_TOKEN),
    gmail: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN),
    "google-drive": Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN),
    "google-calendar": Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN),
    stripe: Boolean(env.STRIPE_SECRET_KEY),
    shopify: Boolean(env.SHOPIFY_ADMIN_TOKEN && env.SHOPIFY_SHOP_DOMAIN),
    crm: Boolean(env.HUBSPOT_ACCESS_TOKEN || env.PIPEDRIVE_API_TOKEN || env.SALESFORCE_ACCESS_TOKEN),
    obsidian: true,
    firecrawl: Boolean(env.FIRECRAWL_API_KEY),
    youtube: Boolean(agenticosConfig.youtubeApiKey && agenticosConfig.youtubeChannelId),
    instagram: Boolean(agenticosConfig.instagramToken && agenticosConfig.instagramAccountId),
    tiktok: Boolean(agenticosConfig.tiktokToken),
    mcp: integration.status === "connected" || integration.status === "partial",
  };

  if (configured[integration.id]) {
    return { ...integration, status: integration.id === "mcp" ? "partial" : "connected", mode: "real" };
  }

  return integration;
}

export async function insertRun(run: Run, plan: AgentPlan) {
  const db = await getDb();
  db.run(
    `INSERT INTO runs (id, title, prompt, selected_skill, category, status, started_at, ended_at, duration_ms, tokens_estimate, cost_estimate, plan_json, files_touched_json, errors_json, final_output, created_artifacts_json, artifacts_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      JSON.stringify(run.artifacts ?? []),
    ],
  );
  await saveDb();
}

export async function updateRun(run: Run, plan?: AgentPlan) {
  const db = await getDb();
  db.run(
    `UPDATE runs SET status = ?, ended_at = ?, duration_ms = ?, tokens_estimate = ?, cost_estimate = ?,
       plan_json = COALESCE(?, plan_json), files_touched_json = ?, errors_json = ?, final_output = ?, created_artifacts_json = ?, artifacts_json = ?, error_detail = ?
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
      JSON.stringify(run.artifacts ?? []),
      run.errorDetail ?? null,
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
    `INSERT INTO approvals (id, run_id, action, integration, affected_resource, command_or_payload, risk_level, explanation, status, created_at, resolved_at, expires_at, payload_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      approval.expiresAt ?? null,
      approval.payload ? JSON.stringify(approval.payload) : null,
    ],
  );
  await saveDb();
}

// Marks any still-pending approvals past their `expires_at` as `expired`.
// Returns the count of approvals that were expired. Safe to call repeatedly.
export async function expireStaleApprovals(): Promise<number> {
  const db = await getDb();
  const now = nowIso();
  const result = db.exec(
    `SELECT id FROM approvals WHERE status = 'pending' AND expires_at IS NOT NULL AND expires_at < ?`,
    [now],
  );
  const ids = (result[0]?.values ?? []).map((row) => String(row[0]));
  if (!ids.length) return 0;
  for (const id of ids) {
    db.run("UPDATE approvals SET status = 'expired', resolved_at = ? WHERE id = ?", [now, id]);
  }
  await saveDb();
  return ids.length;
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
  if (!ids.length) return [];
  const steps = await listSteps(ids);
  const toolCalls = await listToolCalls(ids);
  const approvals = await listApprovals();
  const stepsByRun = new Map<string, RunStep[]>();
  steps.forEach((s) => {
    const arr = stepsByRun.get(s.runId) ?? [];
    arr.push(s);
    stepsByRun.set(s.runId, arr);
  });
  const callsByRun = new Map<string, ToolCall[]>();
  toolCalls.forEach((c) => {
    const arr = callsByRun.get(c.runId) ?? [];
    arr.push(c);
    callsByRun.set(c.runId, arr);
  });
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
    steps: stepsByRun.get(run.id) ?? [],
    toolCalls: callsByRun.get(run.id) ?? [],
    approvals: approvals.filter((approval) => approval.runId === run.id).map((approval) => approval.id),
    filesTouched: parseJson<string[]>(run.files_touched_json, []),
    errors: parseJson<string[]>(run.errors_json, []),
    errorDetail: run.error_detail,
    finalOutput: run.final_output,
    createdArtifacts: parseJson<string[]>(run.created_artifacts_json, []),
    artifacts: parseJson<GeneratedArtifact[]>(run.artifacts_json, []),
  }));
}

export async function getRun(id: string): Promise<Run | undefined> {
  const db = await getDb();
  const runRows = rows<RunRow>(db.exec("SELECT * FROM runs WHERE id = ?", [id]));
  const row = runRows[0];
  if (!row) return undefined;
  const [steps, toolCalls, approvals] = await Promise.all([
    listSteps([id]),
    listToolCalls([id]),
    listApprovals(),
  ]);
  return {
    id: row.id,
    title: row.title,
    prompt: row.prompt,
    selectedSkill: row.selected_skill ?? undefined,
    category: row.category,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    tokensEstimate: row.tokens_estimate,
    costEstimate: row.cost_estimate,
    steps,
    toolCalls,
    approvals: approvals.filter((a) => a.runId === id).map((a) => a.id),
    filesTouched: parseJson<string[]>(row.files_touched_json, []),
    errors: parseJson<string[]>(row.errors_json, []),
    errorDetail: row.error_detail,
    finalOutput: row.final_output,
    createdArtifacts: parseJson<string[]>(row.created_artifacts_json, []),
    artifacts: parseJson<GeneratedArtifact[]>(row.artifacts_json, []),
  };
}

export async function getRunPlan(id: string): Promise<AgentPlan | undefined> {
  const db = await getDb();
  const result = rows<{ plan_json: string }>(db.exec("SELECT plan_json FROM runs WHERE id = ?", [id]));
  return parseJson<AgentPlan | undefined>(result[0]?.plan_json, undefined);
}

async function listSteps(runIds: string[]): Promise<RunStep[]> {
  if (!runIds.length) return [];
  const db = await getDb();
  const placeholders = runIds.map(() => "?").join(",");
  const result = rows<{
    id: string;
    run_id: string;
    step_index: number;
    title: string;
    status: RunStep["status"];
    started_at?: string;
    ended_at?: string;
    observation?: string;
  }>(
    db.exec(
      `SELECT * FROM run_steps WHERE run_id IN (${placeholders}) ORDER BY run_id ASC, step_index ASC`,
      runIds,
    ),
  );
  const seen = new Set<string>();
  const out: RunStep[] = [];
  for (const step of result) {
    if (seen.has(step.id)) continue;
    seen.add(step.id);
    out.push({
      id: step.id,
      runId: step.run_id,
      index: step.step_index,
      title: step.title,
      status: step.status,
      startedAt: step.started_at,
      endedAt: step.ended_at,
      observation: step.observation,
    });
  }
  return out;
}

async function listToolCalls(runIds: string[]): Promise<ToolCall[]> {
  if (!runIds.length) return [];
  const db = await getDb();
  const placeholders = runIds.map(() => "?").join(",");
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
  }>(
    db.exec(
      `SELECT * FROM tool_calls WHERE run_id IN (${placeholders}) ORDER BY created_at ASC`,
      runIds,
    ),
  );
  const seen = new Set<string>();
  const out: ToolCall[] = [];
  for (const call of result) {
    if (seen.has(call.id)) continue;
    seen.add(call.id);
    out.push({
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
    });
  }
  return out;
}

interface ApprovalRow {
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
  expires_at?: string;
  payload_json?: string;
}

function approvalFromRow(row: ApprovalRow): ApprovalRequest {
  return {
    id: row.id,
    runId: row.run_id,
    action: row.action,
    integration: row.integration,
    affectedResource: row.affected_resource,
    commandOrPayload: row.command_or_payload,
    riskLevel: row.risk_level,
    explanation: row.explanation,
    status: row.status,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    expiresAt: row.expires_at,
    payload: parseJson<Record<string, unknown> | undefined>(row.payload_json, undefined),
  };
}

export async function getApproval(id: string): Promise<ApprovalRequest | undefined> {
  const db = await getDb();
  const result = rows<ApprovalRow>(db.exec(`SELECT * FROM approvals WHERE id = ?`, [id]));
  const approval = result[0];
  return approval ? approvalFromRow(approval) : undefined;
}

export async function listApprovals(status?: ApprovalRequest["status"]): Promise<ApprovalRequest[]> {
  const db = await getDb();
  const query = status ? "SELECT * FROM approvals WHERE status = ? ORDER BY created_at DESC" : "SELECT * FROM approvals ORDER BY created_at DESC";
  const result = rows<ApprovalRow>(status ? db.exec(query, [status]) : db.exec(query));
  return result.map(approvalFromRow);
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
  })).map(applyRuntimeIntegrationState);
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

export async function getMemoryItemsByIds(ids: string[]): Promise<MemoryItem[]> {
  if (ids.length === 0) return [];
  const db = await getDb();
  const placeholders = ids.map(() => "?").join(",");
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
  }>(db.exec(`SELECT * FROM memory_index WHERE id IN (${placeholders})`, ids));
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

// ─── Vault Graph ──────────────────────────────────────────────────────────────

export interface VaultNode {
  path: string;
  title: string;
  folder: string;
  wordCount: number;
  linkCount: number;
  backlinkCount?: number;
  lastIndexed: string;
  exists: boolean;
}

export interface VaultLink {
  source: string;
  target: string;
  resolvedPath?: string | null;
}

export interface GraphStats {
  nodeCount: number;
  linkCount: number;
  orphanCount: number;
  mostLinked: { path: string; title: string; count: number } | null;
}

function selectRows<T extends object>(
  db: import("sql.js").Database,
  sql: string,
  params: (string | number | null)[] = [],
): T[] {
  // Both sql.js and the better-sqlite3 shim expose exec(sql, params) returning
  // [{ columns, values }]. Avoid the prepare/bind/step path so the native
  // adapter (which has no prepare/step surface) keeps working.
  if (!params.length) return rows<T>(db.exec(sql));
  return rows<T>(db.exec(sql, params));
}

export async function upsertVaultNode(node: VaultNode): Promise<void> {
  const db = await getDb();
  db.run(
    `INSERT INTO vault_nodes (path, title, folder, word_count, link_count, last_indexed, file_exists)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       title = excluded.title, folder = excluded.folder,
       word_count = excluded.word_count, link_count = excluded.link_count,
       last_indexed = excluded.last_indexed, file_exists = excluded.file_exists`,
    [node.path, node.title, node.folder, node.wordCount, node.linkCount, node.lastIndexed, node.exists ? 1 : 0],
  );
  await saveDb();
}

export async function upsertVaultLink(source: string, target: string, resolvedPath?: string): Promise<void> {
  const db = await getDb();
  db.run(
    "INSERT OR IGNORE INTO vault_links (source, target, resolved_path, created_at) VALUES (?, ?, ?, ?)",
    [source, target, resolvedPath ?? null, nowIso()],
  );
  await saveDb();
}

export async function clearVaultLinks(source: string): Promise<void> {
  const db = await getDb();
  db.run("DELETE FROM vault_links WHERE source = ?", [source]);
  await saveDb();
}

export async function updateBacklinkCounts(): Promise<void> {
  const db = await getDb();
  // Match by title OR resolved_path OR by the bare filename slug — that last
  // arm catches links whose `target` is just the note's basename even when
  // the link was never "resolved" to a full path.
  db.run(`
    UPDATE vault_nodes SET backlink_count = (
      SELECT COUNT(*) FROM vault_links
      WHERE vault_links.target = vault_nodes.title
         OR vault_links.resolved_path = vault_nodes.path
         OR vault_links.target = REPLACE(SUBSTR(vault_nodes.path, INSTR(vault_nodes.path, '/') + 1), '.md', '')
    )
  `);
  await saveDb();
}

export async function getBacklinks(notePath: string): Promise<VaultLink[]> {
  const db = await getDb();
  const noteName = notePath.replace(/^.*\//, "").replace(/\.md$/, "");
  // Match by resolved path OR by short slug — covers both resolved and
  // unresolved wikilinks pointing at this note.
  return selectRows<{ source: string; target: string; resolved_path: string | null }>(
    db,
    "SELECT source, target, resolved_path FROM vault_links WHERE resolved_path = ? OR target = ? OR target = ?",
    [notePath, noteName, notePath],
  ).map((r) => ({ source: r.source, target: r.target, resolvedPath: r.resolved_path }));
}

export async function getOutlinks(notePath: string): Promise<VaultLink[]> {
  const db = await getDb();
  return selectRows<{ source: string; target: string; resolved_path: string | null }>(
    db,
    "SELECT source, target, resolved_path FROM vault_links WHERE source = ?",
    [notePath],
  ).map((r) => ({ source: r.source, target: r.target, resolvedPath: r.resolved_path }));
}

export async function getGraphStats(): Promise<GraphStats> {
  const db = await getDb();
  const nodeCount = (db.exec("SELECT COUNT(*) FROM vault_nodes WHERE file_exists = 1")[0]?.values[0]?.[0] as number) ?? 0;
  const linkCount = (db.exec("SELECT COUNT(*) FROM vault_links")[0]?.values[0]?.[0] as number) ?? 0;
  const orphanCount = (db.exec("SELECT COUNT(*) FROM vault_nodes WHERE file_exists = 1 AND backlink_count = 0 AND link_count = 0")[0]?.values[0]?.[0] as number) ?? 0;
  const top = selectRows<{ path: string; title: string; backlink_count: number }>(
    db,
    "SELECT path, title, backlink_count FROM vault_nodes WHERE file_exists = 1 ORDER BY backlink_count DESC LIMIT 1",
  )[0];
  return {
    nodeCount,
    linkCount,
    orphanCount,
    mostLinked: top ? { path: top.path, title: top.title, count: top.backlink_count } : null,
  };
}

export async function getOrphanNodes(limit = 20): Promise<VaultNode[]> {
  const db = await getDb();
  return selectRows<{
    path: string; title: string; folder: string;
    word_count: number; link_count: number; backlink_count: number;
    last_indexed: string; file_exists: number;
  }>(
    db,
    `SELECT * FROM vault_nodes WHERE file_exists = 1 AND backlink_count = 0 AND link_count = 0
     ORDER BY last_indexed DESC LIMIT ?`,
    [limit],
  ).map((r) => ({
    path: r.path, title: r.title, folder: r.folder,
    wordCount: r.word_count, linkCount: r.link_count, backlinkCount: r.backlink_count,
    lastIndexed: r.last_indexed, exists: Boolean(r.file_exists),
  }));
}

export async function getMostLinkedNodes(limit = 10): Promise<VaultNode[]> {
  const db = await getDb();
  return selectRows<{
    path: string; title: string; folder: string;
    word_count: number; link_count: number; backlink_count: number;
    last_indexed: string; file_exists: number;
  }>(
    db,
    "SELECT * FROM vault_nodes WHERE file_exists = 1 ORDER BY backlink_count DESC, link_count DESC LIMIT ?",
    [limit],
  ).map((r) => ({
    path: r.path, title: r.title, folder: r.folder,
    wordCount: r.word_count, linkCount: r.link_count, backlinkCount: r.backlink_count,
    lastIndexed: r.last_indexed, exists: Boolean(r.file_exists),
  }));
}

export interface VaultGraphBatch {
  nodes: VaultNode[];
  links: Array<{ source: string; target: string }>;
}

export async function batchUpsertVaultGraph(batch: VaultGraphBatch): Promise<void> {
  const db = await getDb();
  const ts = nowIso();
  const sources = new Set(batch.nodes.map((n) => n.path));

  db.run("BEGIN");
  try {
    for (const src of sources) {
      db.run("DELETE FROM vault_links WHERE source = ?", [src]);
    }
    for (const node of batch.nodes) {
      db.run(
        `INSERT INTO vault_nodes (path, title, folder, word_count, link_count, last_indexed, file_exists)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(path) DO UPDATE SET
           title = excluded.title, folder = excluded.folder,
           word_count = excluded.word_count, link_count = excluded.link_count,
           last_indexed = excluded.last_indexed, file_exists = excluded.file_exists`,
        [node.path, node.title, node.folder, node.wordCount, node.linkCount, node.lastIndexed, node.exists ? 1 : 0],
      );
    }
    for (const link of batch.links) {
      db.run(
        "INSERT OR IGNORE INTO vault_links (source, target, resolved_path, created_at) VALUES (?, ?, ?, ?)",
        [link.source, link.target, null, ts],
      );
    }
    db.run(`
      UPDATE vault_nodes SET backlink_count = (
        SELECT COUNT(*) FROM vault_links
        WHERE vault_links.target = vault_nodes.title
           OR vault_links.resolved_path = vault_nodes.path
      )
    `);
    db.run("COMMIT");
  } catch (err) {
    db.run("ROLLBACK");
    throw err;
  }
  await saveDb();
}

export async function getPromotionCandidates(threshold = 3): Promise<VaultNode[]> {
  const db = await getDb();
  return selectRows<{
    path: string; title: string; folder: string;
    word_count: number; link_count: number; backlink_count: number;
    last_indexed: string; file_exists: number;
  }>(
    db,
    "SELECT * FROM vault_nodes WHERE folder = 'raw' AND file_exists = 1 AND backlink_count >= ? ORDER BY backlink_count DESC LIMIT 20",
    [threshold],
  ).map((r) => ({
    path: r.path, title: r.title, folder: r.folder,
    wordCount: r.word_count, linkCount: r.link_count, backlinkCount: r.backlink_count,
    lastIndexed: r.last_indexed, exists: Boolean(r.file_exists),
  }));
}

export async function markVaultNodeMoved(oldPath: string, newPath: string): Promise<void> {
  const db = await getDb();
  db.run("UPDATE vault_nodes SET file_exists = 0 WHERE path = ?", [oldPath]);
  db.run("UPDATE vault_links SET resolved_path = ? WHERE resolved_path = ?", [newPath, oldPath]);
  await saveDb();
}
