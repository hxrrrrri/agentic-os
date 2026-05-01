import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import initSqlJs, { type Database, type SqlJsStatic } from "sql.js";
import { agenticosConfig } from "@/agenticos.config";
import { seedIntegrations } from "@/data/seed-integrations";
import { seedRoutines } from "@/data/seed-routines";
import { ensureVault } from "@/lib/vault/service";

let SQL: SqlJsStatic | undefined;
let db: Database | undefined;
let initialized = false;

async function getSql() {
  if (!SQL) {
    SQL = await initSqlJs({
      locateFile: (file: string) => path.join(process.cwd(), "node_modules", "sql.js", "dist", file),
    });
  }
  return SQL;
}

export async function getDb() {
  if (!db) {
    const sql = await getSql();
    await fsp.mkdir(path.dirname(agenticosConfig.databasePath), { recursive: true });
    if (fs.existsSync(agenticosConfig.databasePath)) {
      db = new sql.Database(fs.readFileSync(agenticosConfig.databasePath));
    } else {
      db = new sql.Database();
    }
  }
  if (!initialized) {
    await initializeDb(db);
    initialized = true;
  }
  return db;
}

export async function saveDb() {
  if (!db) return;
  await fsp.mkdir(path.dirname(agenticosConfig.databasePath), { recursive: true });
  fs.writeFileSync(agenticosConfig.databasePath, Buffer.from(db.export()));
}

function run(database: Database, sql: string, params: Array<string | number | null> = []) {
  database.run(sql, params);
}

async function initializeDb(database: Database) {
  await ensureVault();
  database.run(`
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      prompt TEXT NOT NULL,
      selected_skill TEXT,
      category TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      duration_ms INTEGER,
      tokens_estimate INTEGER NOT NULL DEFAULT 0,
      cost_estimate REAL NOT NULL DEFAULT 0,
      plan_json TEXT NOT NULL DEFAULT '{}',
      files_touched_json TEXT NOT NULL DEFAULT '[]',
      errors_json TEXT NOT NULL DEFAULT '[]',
      final_output TEXT,
      created_artifacts_json TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS run_steps (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_index INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      started_at TEXT,
      ended_at TEXT,
      observation TEXT
    );

    CREATE TABLE IF NOT EXISTS tool_calls (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      step_id TEXT,
      tool TEXT NOT NULL,
      action TEXT NOT NULL,
      input TEXT NOT NULL,
      output TEXT,
      risk_level TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS approvals (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      action TEXT NOT NULL,
      integration TEXT NOT NULL,
      affected_resource TEXT NOT NULL,
      command_or_payload TEXT NOT NULL,
      risk_level TEXT NOT NULL,
      explanation TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS memory_index (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      tags_json TEXT NOT NULL,
      summary TEXT NOT NULL,
      last_updated TEXT NOT NULL,
      embedding_placeholder TEXT NOT NULL,
      importance_score REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      mode TEXT NOT NULL,
      description TEXT NOT NULL,
      actions_json TEXT NOT NULL,
      last_used TEXT,
      enabled INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS routines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      skill_id TEXT NOT NULL,
      schedule TEXT NOT NULL,
      trigger_type TEXT NOT NULL,
      enabled INTEGER NOT NULL,
      last_run TEXT,
      next_run TEXT,
      approval_mode TEXT NOT NULL,
      output_destination TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      actor TEXT NOT NULL,
      action TEXT NOT NULL,
      integration TEXT,
      risk_level TEXT NOT NULL,
      result TEXT NOT NULL
    );
  `);

  const integrationCount = database.exec("SELECT COUNT(*) AS count FROM integrations")[0]?.values[0]?.[0] as number | undefined;
  if (!integrationCount) {
    seedIntegrations.forEach((integration) =>
      run(
        database,
        `INSERT INTO integrations (id, name, status, mode, description, actions_json, last_used, enabled)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          integration.id,
          integration.name,
          integration.status,
          integration.mode,
          integration.description,
          JSON.stringify(integration.actions),
          integration.lastUsed ?? null,
          integration.enabled ? 1 : 0,
        ],
      ),
    );
  }

  const routineCount = database.exec("SELECT COUNT(*) AS count FROM routines")[0]?.values[0]?.[0] as number | undefined;
  if (!routineCount) {
    seedRoutines.forEach((routine) =>
      run(
        database,
        `INSERT INTO routines (id, name, description, skill_id, schedule, trigger_type, enabled, last_run, next_run, approval_mode, output_destination)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          routine.id,
          routine.name,
          routine.description,
          routine.skillId,
          routine.schedule,
          routine.triggerType,
          routine.enabled ? 1 : 0,
          routine.lastRun ?? null,
          routine.nextRun ?? null,
          routine.approvalMode,
          routine.outputDestination,
        ],
      ),
    );
  }

  await saveDb();
}

export function rows<T>(result: { columns: string[]; values: unknown[][] }[]): T[] {
  const table = result[0];
  if (!table) return [];
  return table.values.map((valueRow) =>
    Object.fromEntries(table.columns.map((column, index) => [column, valueRow[index]])),
  ) as T[];
}
