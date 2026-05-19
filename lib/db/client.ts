import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import type { Database, SqlJsStatic } from "sql.js";
import { agenticosConfig } from "@/agenticos.config";
import { seedIntegrations } from "@/data/seed-integrations";
import { seedRoutines } from "@/data/seed-routines";
import { ensureVault } from "@/lib/vault/service";
import { isNativeAvailable, openNativeDb } from "@/lib/db/native-adapter";

let SQL: SqlJsStatic | undefined;
let db: Database | undefined;
let initialized = false;
let dbFileMtimeMs = 0;
const useNative = isNativeAvailable();

type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<SqlJsStatic>;

function loadInitSqlJs(): InitSqlJs {
  const runtimeRequire = eval("require") as NodeRequire;
  const loaded = runtimeRequire("sql.js") as InitSqlJs | { default?: InitSqlJs };
  if (typeof loaded === "function") return loaded;
  if (loaded.default) return loaded.default;
  throw new Error("Could not load sql.js");
}

async function getSql() {
  if (!SQL) {
    // The wasm file ships inside `sql.js/dist/sql-wasm.wasm`. Resolution has
    // to work in three environments:
    //   - Dev / prod: process.cwd() is the repo root
    //   - Vitest:     process.cwd() is a per-test temp dir (no node_modules)
    //   - Turbopack:  require.resolve("sql.js") returns a virtual `[externals]`
    //                 path that does NOT exist on disk
    // Probe filesystem candidates and pick the first that has the wasm file.
    const probeFile = "sql-wasm.wasm";
    const candidates: string[] = [path.join(process.cwd(), "node_modules", "sql.js", "dist")];

    // Vitest changes process.cwd() to per-test temp directories. Resolve the
    // installed package from this module as the stable fallback.
    // `eval("require")` keeps this out of Turbopack's static graph — otherwise
    try {
      const runtimeRequire = eval("require") as NodeRequire;
      const wasmPath = runtimeRequire.resolve(["sql.js", "dist", "sql-wasm.wasm"].join("/"));
      candidates.push(path.dirname(wasmPath));
    } catch {}
    try {
      const runtimeRequire = eval("require") as NodeRequire;
      candidates.push(path.dirname(runtimeRequire.resolve("sql.js")));
    } catch {}

    let wasmDir: string | undefined;
    for (const candidate of candidates) {
      try {
        if (fs.existsSync(path.join(candidate, probeFile))) {
          wasmDir = candidate;
          break;
        }
      } catch {}
    }
    if (!wasmDir) {
      throw new Error(`Could not locate ${probeFile}; checked ${candidates.join(", ")}`);
    }
    const initSqlJs = loadInitSqlJs();
    SQL = await initSqlJs({ locateFile: (file: string) => path.join(wasmDir, file) });
  }
  return SQL;
}

export async function getDb(): Promise<Database> {
  if (!db) {
    await loadDbFromDisk();
  } else {
    await reloadDbIfChanged();
  }
  if (!db) throw new Error("Database failed to initialize");
  if (!initialized) {
    await initializeDb(db);
    initialized = true;
  }
  return db;
}

async function getDbFileMtime() {
  try {
    return (await fsp.stat(agenticosConfig.databasePath)).mtimeMs;
  } catch {
    return 0;
  }
}

async function loadDbFromDisk() {
  await fsp.mkdir(path.dirname(agenticosConfig.databasePath), { recursive: true });
  if (useNative) {
    db = openNativeDb(agenticosConfig.databasePath) as unknown as Database;
    dbFileMtimeMs = await getDbFileMtime();
    initialized = false;
    return;
  }
  await recoverDbFromTempExports();
  const sql = await getSql();
  if (fs.existsSync(agenticosConfig.databasePath)) {
    db = new sql.Database(fs.readFileSync(agenticosConfig.databasePath));
    dbFileMtimeMs = await getDbFileMtime();
  } else {
    db = new sql.Database();
    dbFileMtimeMs = 0;
  }
  initialized = false;
}

async function reloadDbIfChanged() {
  // Native (better-sqlite3) persists on every write — no need to re-read for
  // freshness. Only sql.js (in-memory backed) needs the mtime check.
  if (useNative) return;
  if (savePending || saveTimer) return;
  const latestMtime = await getDbFileMtime();
  if (!latestMtime || latestMtime <= dbFileMtimeMs + 1) return;

  try {
    db?.close();
  } catch {}
  await loadDbFromDisk();
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let savePending: Promise<void> | null = null;
const SAVE_DEBOUNCE_MS = 250;
const SAVE_RETRIES = 8;
const RECOVERY_SCAN_LIMIT = 200;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetriableReplaceError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return code === "EPERM" || code === "EACCES" || code === "EBUSY" || code === "EEXIST";
}

async function replaceFileWithRetry(tmp: string, target: string) {
  let lastError: unknown;

  for (let attempt = 0; attempt < SAVE_RETRIES; attempt += 1) {
    try {
      await fsp.rename(tmp, target);
      return;
    } catch (error) {
      lastError = error;
      if (!isRetriableReplaceError(error)) throw error;

      // Windows can briefly lock the previous sqlite export while another
      // route or antivirus scanner reads it. Retrying avoids marking a good
      // model run failed because the local DB file was busy for a moment.
      await wait(35 * 2 ** attempt);
    }
  }

  try {
    // Preserve the last good DB if Windows still has the target locked.
    // copyFile overwrites when possible; if it cannot, the old target remains.
    await fsp.copyFile(tmp, target);
    await fsp.rm(tmp, { force: true });
    return;
  } catch (error) {
    throw lastError ?? error;
  }
}

interface DbSnapshot {
  filePath: string;
  mtimeMs: number;
  size: number;
  runCount: number;
  score: number;
}

function tableCount(database: Database, table: string): number {
  try {
    return Number(database.exec(`SELECT COUNT(*) FROM ${table}`)[0]?.values[0]?.[0] ?? 0);
  } catch {
    return 0;
  }
}

async function snapshotDbFile(filePath: string): Promise<DbSnapshot | null> {
  try {
    const stat = await fsp.stat(filePath);
    if (!stat.isFile() || stat.size === 0) return null;

    const sql = await getSql();
    const candidate = new sql.Database(await fsp.readFile(filePath));
    try {
      const runCount = tableCount(candidate, "runs");
      const score =
        runCount * 1000 +
        tableCount(candidate, "run_steps") * 20 +
        tableCount(candidate, "tool_calls") * 10 +
        tableCount(candidate, "approvals") * 10 +
        tableCount(candidate, "memory_index") * 8 +
        tableCount(candidate, "vault_nodes") * 4 +
        tableCount(candidate, "usage_meter") * 3 +
        tableCount(candidate, "jobs") * 2 +
        tableCount(candidate, "routines") +
        tableCount(candidate, "integrations");
      return { filePath, mtimeMs: stat.mtimeMs, size: stat.size, runCount, score };
    } finally {
      candidate.close();
    }
  } catch {
    return null;
  }
}

async function recoverDbFromTempExports(): Promise<void> {
  const target = agenticosConfig.databasePath;
  const dir = path.dirname(target);
  const base = path.basename(target);

  let entries: string[];
  try {
    entries = await fsp.readdir(dir);
  } catch {
    return;
  }

  const active = fs.existsSync(target) ? await snapshotDbFile(target) : null;
  if (active && active.runCount > 0) return;

  const tempFiles = entries
    .filter((name) => name.startsWith(`${base}.`) && name.endsWith(".tmp"))
    .map((name) => path.join(dir, name))
    .sort((a, b) => {
      try {
        return fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs;
      } catch {
        return 0;
      }
    })
    .slice(0, RECOVERY_SCAN_LIMIT);

  let best: DbSnapshot | null = null;
  for (const file of tempFiles) {
    const snapshot = await snapshotDbFile(file);
    if (!snapshot) continue;
    if (!best || snapshot.score > best.score || (snapshot.score === best.score && snapshot.mtimeMs > best.mtimeMs)) {
      best = snapshot;
    }
  }

  if (!best || best.score <= (active?.score ?? 0) || best.runCount <= (active?.runCount ?? 0)) return;

  if (fs.existsSync(target)) {
    await fsp.copyFile(target, `${target}.${Date.now()}.bak-empty`).catch(() => {});
  }
  await fsp.copyFile(best.filePath, target);
  dbFileMtimeMs = await getDbFileMtime();
}

async function writeNow() {
  if (!db) return;
  // better-sqlite3 writes through to the file on every statement, so there's
  // nothing to serialize — short-circuit and avoid the sql.js export() cost.
  if (useNative) {
    dbFileMtimeMs = await getDbFileMtime();
    return;
  }
  await fsp.mkdir(path.dirname(agenticosConfig.databasePath), { recursive: true });
  const tmp = `${agenticosConfig.databasePath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`;
  try {
    await fsp.writeFile(tmp, Buffer.from(db.export()));
    await replaceFileWithRetry(tmp, agenticosConfig.databasePath);
  } finally {
    await fsp.rm(tmp, { force: true }).catch(() => {});
  }
  dbFileMtimeMs = await getDbFileMtime();
}

export function saveDb(): Promise<void> {
  // Native sqlite writes synchronously on every statement — no debounced export
  // needed. Skip the 250ms timer so awaited saveDb() doesn't stall the workflow
  // (with ~10 calls per run, the old path burned ~2.5s of pure latency).
  if (useNative) return Promise.resolve();
  if (savePending) return savePending;
  savePending = new Promise<void>((resolve, reject) => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      writeNow()
        .then(() => {
          savePending = null;
          resolve();
        })
        .catch((err) => {
          savePending = null;
          reject(err);
        });
    }, SAVE_DEBOUNCE_MS);
  });
  return savePending;
}

// Test-only helper. Closes the in-memory db handle so the test harness can
// delete its temp directory on Windows without EBUSY. Safe to call in prod
// too — the next getDb() will lazy-reopen.
export async function closeDb(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (savePending) {
    await savePending.catch(() => {});
  }
  try {
    db?.close();
  } catch {}
  db = undefined;
  initialized = false;
}

export async function saveDbNow(): Promise<void> {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  await writeNow();
}

// Flush on shutdown so debounced writes don't get lost.
if (typeof process !== "undefined" && !(globalThis as { __agenticosFlushAttached?: boolean }).__agenticosFlushAttached) {
  (globalThis as { __agenticosFlushAttached?: boolean }).__agenticosFlushAttached = true;
  const flush = () => {
    if (!db) return;
    if (useNative) return; // native writes synchronously already
    try {
      fs.writeFileSync(agenticosConfig.databasePath, Buffer.from(db.export()));
    } catch {}
  };
  process.on("beforeExit", flush);
  process.on("SIGINT", () => {
    flush();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    flush();
    process.exit(0);
  });
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

    CREATE TABLE IF NOT EXISTS vault_nodes (
      path TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      folder TEXT NOT NULL DEFAULT '',
      word_count INTEGER NOT NULL DEFAULT 0,
      link_count INTEGER NOT NULL DEFAULT 0,
      backlink_count INTEGER NOT NULL DEFAULT 0,
      last_indexed TEXT NOT NULL DEFAULT '',
      file_exists INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS vault_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source TEXT NOT NULL,
      target TEXT NOT NULL,
      resolved_path TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(source, target)
    );

    CREATE INDEX IF NOT EXISTS idx_vault_links_source ON vault_links(source);
    CREATE INDEX IF NOT EXISTS idx_vault_links_target ON vault_links(target);

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      run_after TEXT NOT NULL,
      created_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      error TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_jobs_status_runafter ON jobs(status, run_after);

    CREATE TABLE IF NOT EXISTS memory_embeddings (
      id TEXT PRIMARY KEY,
      memory_id TEXT NOT NULL,
      model TEXT NOT NULL,
      dim INTEGER NOT NULL,
      vector_b64 TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_memory_embeddings_memory ON memory_embeddings(memory_id);

    CREATE TABLE IF NOT EXISTS usage_meter (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      day TEXT NOT NULL,
      run_id TEXT,
      skill_id TEXT,
      provider TEXT,
      model TEXT,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_usage_meter_day ON usage_meter(day);

    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      window TEXT NOT NULL,
      max_cost_usd REAL NOT NULL,
      max_runs INTEGER,
      updated_at TEXT NOT NULL
    );

    -- F1: Agent inbox
    CREATE TABLE IF NOT EXISTS inbox_items (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      sender TEXT,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'new',
      draft_reply TEXT,
      run_id TEXT,
      received_at TEXT NOT NULL,
      handled_at TEXT,
      metadata_json TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_inbox_status ON inbox_items(status, received_at);

    -- F2: Browser recorder traces
    CREATE TABLE IF NOT EXISTS browser_traces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      start_url TEXT,
      steps_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      compiled_skill_id TEXT
    );

    -- F3: Workflows
    CREATE TABLE IF NOT EXISTS workflows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      nodes_json TEXT NOT NULL,
      edges_json TEXT NOT NULL,
      trigger TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- F4: Workspaces + members
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS workspace_members (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(workspace_id, user_email)
    );

    -- F5: Vault chunks for fine-grained semantic retrieval
    CREATE TABLE IF NOT EXISTS vault_chunks (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(file_path, chunk_index)
    );
    CREATE INDEX IF NOT EXISTS idx_vault_chunks_file ON vault_chunks(file_path);

    -- F6: Prompt cache for cost governor
    CREATE TABLE IF NOT EXISTS prompt_cache (
      hash TEXT PRIMARY KEY,
      provider TEXT,
      model TEXT,
      response TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      hits INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      last_hit_at TEXT
    );

    -- F7: Connectors marketplace (installed instances)
    CREATE TABLE IF NOT EXISTS connectors_installed (
      id TEXT PRIMARY KEY,
      connector_id TEXT NOT NULL,
      label TEXT,
      config_json TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      installed_at TEXT NOT NULL
    );

    -- F8: Voice transcripts
    CREATE TABLE IF NOT EXISTS voice_intents (
      id TEXT PRIMARY KEY,
      transcript TEXT NOT NULL,
      intent TEXT,
      skill_id TEXT,
      run_id TEXT,
      created_at TEXT NOT NULL
    );

    -- F9: Compliance pack — subject erasure log + snapshots
    CREATE TABLE IF NOT EXISTS compliance_events (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      subject TEXT,
      affected_rows INTEGER,
      detail TEXT,
      created_at TEXT NOT NULL
    );

    -- F10: Self-improving loop — run grades + distilled skill patches
    CREATE TABLE IF NOT EXISTS run_grades (
      id TEXT PRIMARY KEY,
      run_id TEXT NOT NULL,
      skill_id TEXT,
      score REAL NOT NULL,
      rubric_json TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_run_grades_skill ON run_grades(skill_id, score);

    CREATE TABLE IF NOT EXISTS skill_patches (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      patch_prompt TEXT NOT NULL,
      based_on_run_ids TEXT,
      created_at TEXT NOT NULL,
      adopted INTEGER NOT NULL DEFAULT 0
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
  } else {
    seedIntegrations.forEach((integration) =>
      run(
        database,
        `INSERT OR IGNORE INTO integrations (id, name, status, mode, description, actions_json, last_used, enabled)
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

  // Apply pending column migrations. CREATE TABLE IF NOT EXISTS does not add
  // columns to a pre-existing table, so anything beyond the initial schema
  // ships through here.
  await runMigrations(database);

  await saveDb();
}

// ─── Schema migrations ──────────────────────────────────────────────────────
// Each migration is { version, up(db) }. We store the current version in
// `schema_version` and run anything newer in order. Migrations must be
// idempotent (CHECK column existence before ALTER) so a partial-apply doesn't
// brick the DB.
interface Migration {
  version: number;
  description: string;
  up: (db: Database) => void;
}

function columnExists(db: Database, table: string, column: string): boolean {
  const result = db.exec(`PRAGMA table_info(${table})`);
  const cols = result[0]?.values.map((row) => String(row[1])) ?? [];
  return cols.includes(column);
}

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    description: "runs.error_detail (stack + provider body)",
    up(db) {
      if (!columnExists(db, "runs", "error_detail")) {
        db.run("ALTER TABLE runs ADD COLUMN error_detail TEXT");
      }
    },
  },
  {
    version: 2,
    description: "approvals.expires_at + auto-timeout sweeper",
    up(db) {
      if (!columnExists(db, "approvals", "expires_at")) {
        db.run("ALTER TABLE approvals ADD COLUMN expires_at TEXT");
      }
    },
  },
  {
    version: 3,
    description: "runs.artifacts_json — structured artifact records (carousels, images, etc.)",
    up(db) {
      if (!columnExists(db, "runs", "artifacts_json")) {
        db.run("ALTER TABLE runs ADD COLUMN artifacts_json TEXT NOT NULL DEFAULT '[]'");
      }
    },
  },
  {
    version: 4,
    description: "approvals.payload_json — captures the original tool-call args for replay after approve",
    up(db) {
      if (!columnExists(db, "approvals", "payload_json")) {
        db.run("ALTER TABLE approvals ADD COLUMN payload_json TEXT");
      }
    },
  },
];

async function runMigrations(database: Database): Promise<void> {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL,
      description TEXT NOT NULL
    );
  `);
  const result = database.exec("SELECT COALESCE(MAX(version), 0) AS v FROM schema_version");
  const current = Number(result[0]?.values[0]?.[0] ?? 0);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);
  for (const migration of pending) {
    migration.up(database);
    database.run(
      "INSERT INTO schema_version (version, applied_at, description) VALUES (?, ?, ?)",
      [migration.version, new Date().toISOString(), migration.description],
    );
  }
}

export function rows<T>(result: { columns: string[]; values: unknown[][] }[]): T[] {
  const table = result[0];
  if (!table) return [];
  return table.values.map((valueRow) =>
    Object.fromEntries(table.columns.map((column, index) => [column, valueRow[index]])),
  ) as T[];
}
