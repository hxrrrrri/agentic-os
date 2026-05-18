/**
 * Compliance pack — encrypted vault snapshot, audit-log CSV export, and
 * GDPR-style subject erasure across vault + DB.
 */

import { createCipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { agenticosConfig } from "@/agenticos.config";
import { getDb, saveDb, rows } from "@/lib/db/client";
import { listVaultFiles } from "@/lib/vault/service";
import { createId, nowIso } from "@/lib/utils";

const SNAPSHOT_DIR = path.join(process.cwd(), ".agenticos", "snapshots");
const SALT = Buffer.from("agenticos-compliance-v1", "utf8");

function deriveKey(): Buffer {
  const passphrase = process.env.AGENTICOS_SECRETS_KEY ?? `${os.hostname()}::${os.userInfo().username}::agenticos`;
  return scryptSync(passphrase, SALT, 32);
}

export interface SnapshotResult {
  id: string;
  path: string;
  files: number;
  bytes: number;
  createdAt: string;
}

async function listAllVaultPathsRecursive(): Promise<string[]> {
  const all = await listVaultFiles("", 5000);
  return all.map((f) => f.path);
}

/** Encrypted line-delimited JSONL snapshot — keeps it simple and streamable. */
export async function createVaultSnapshot(): Promise<SnapshotResult> {
  await fsp.mkdir(SNAPSHOT_DIR, { recursive: true });
  const id = createId("snap");
  const now = nowIso();
  const filePath = path.join(SNAPSHOT_DIR, `${id}.bin`);
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);

  const files = await listAllVaultPathsRecursive();
  let bytes = 0;
  const chunks: Buffer[] = [];
  for (const rel of files) {
    const abs = path.join(agenticosConfig.vaultPath, rel);
    try {
      const content = await fsp.readFile(abs, "utf8");
      const line = JSON.stringify({ path: rel, content }) + "\n";
      chunks.push(cipher.update(line, "utf8"));
      bytes += line.length;
    } catch {
      /* skip */
    }
  }
  chunks.push(cipher.final());
  const tag = cipher.getAuthTag();
  const final = Buffer.concat([iv, tag, ...chunks]);
  await fsp.writeFile(filePath, final);

  await recordEvent("snapshot_created", undefined, files.length, `path=${filePath} bytes=${bytes}`);
  return { id, path: filePath, files: files.length, bytes, createdAt: now };
}

export async function listSnapshots(): Promise<Array<{ id: string; path: string; size: number; createdAt: string }>> {
  await fsp.mkdir(SNAPSHOT_DIR, { recursive: true });
  const entries = await fsp.readdir(SNAPSHOT_DIR);
  const out: Array<{ id: string; path: string; size: number; createdAt: string }> = [];
  for (const name of entries) {
    if (!name.endsWith(".bin")) continue;
    const full = path.join(SNAPSHOT_DIR, name);
    const stat = await fsp.stat(full);
    out.push({ id: name.replace(/\.bin$/, ""), path: full, size: stat.size, createdAt: stat.mtime.toISOString() });
  }
  return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface AuditCsvLine { ts: string; actor: string; action: string; integration: string; risk: string; result: string }

export async function exportAuditCsv(): Promise<string> {
  const db = await getDb();
  const result = db.exec(`SELECT timestamp, actor, action, integration, risk_level, result FROM audit_logs ORDER BY timestamp DESC LIMIT 50000`);
  const items = rows<{ timestamp: string; actor: string; action: string; integration: string; risk_level: string; result: string }>(result);
  const header = "timestamp,actor,action,integration,risk,result";
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const body = items.map((r) => [r.timestamp, r.actor, r.action, r.integration, r.risk_level, r.result].map(escape).join(",")).join("\n");
  return `${header}\n${body}`;
}

export interface GdprResult {
  subject: string;
  vaultFilesRedacted: number;
  dbRowsRedacted: number;
}

const SUBJECT_TABLES: Array<{ table: string; columns: string[] }> = [
  { table: "inbox_items",     columns: ["sender", "subject", "body", "draft_reply"] },
  { table: "voice_intents",   columns: ["transcript"] },
  { table: "audit_logs",      columns: ["action"] },
  { table: "memory_index",    columns: ["summary", "title"] },
  { table: "approvals",       columns: ["affected_resource", "command_or_payload", "explanation"] },
];

export async function gdprErase(subject: string): Promise<GdprResult> {
  if (!subject || subject.length < 3) throw new Error("Subject must be at least 3 characters");
  const db = await getDb();
  let dbRows = 0;
  for (const cfg of SUBJECT_TABLES) {
    for (const col of cfg.columns) {
      try {
        db.run(`UPDATE ${cfg.table} SET ${col} = '[ERASED:${escapeForSql(subject)}]' WHERE ${col} LIKE ?`, [`%${subject}%`]);
        // We can't get rowsAffected portably; approximate with a follow-up SELECT.
        const after = db.exec(`SELECT COUNT(*) FROM ${cfg.table} WHERE ${col} = '[ERASED:${escapeForSql(subject)}]'`);
        dbRows += Number(after[0]?.values[0]?.[0] ?? 0);
      } catch { /* table/column may not exist on older DBs */ }
    }
  }

  let vaultFiles = 0;
  const files = await listAllVaultPathsRecursive();
  for (const rel of files) {
    const abs = path.join(agenticosConfig.vaultPath, rel);
    try {
      const content = await fsp.readFile(abs, "utf8");
      if (!content.includes(subject)) continue;
      const replaced = content.split(subject).join(`[ERASED]`);
      await fsp.writeFile(abs, replaced, "utf8");
      vaultFiles++;
    } catch { /* skip */ }
  }
  await saveDb();
  await recordEvent("gdpr_erase", subject, vaultFiles + dbRows, `vault=${vaultFiles} db=${dbRows}`);
  return { subject, vaultFilesRedacted: vaultFiles, dbRowsRedacted: dbRows };
}

function escapeForSql(s: string): string {
  return s.replace(/'/g, "''");
}

async function recordEvent(kind: string, subject?: string, affectedRows?: number, detail?: string): Promise<void> {
  const db = await getDb();
  const id = createId("comp");
  db.run(
    `INSERT INTO compliance_events (id, kind, subject, affected_rows, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, kind, subject ?? null, affectedRows ?? null, detail ?? null, nowIso()],
  );
  await saveDb();
}

export async function listComplianceEvents(limit = 100): Promise<Array<{ id: string; kind: string; subject?: string; affectedRows?: number; detail?: string; createdAt: string }>> {
  const db = await getDb();
  const result = db.exec(`SELECT id, kind, subject, affected_rows, detail, created_at FROM compliance_events ORDER BY created_at DESC LIMIT ${Number(limit) || 100}`);
  return rows<{ id: string; kind: string; subject: string | null; affected_rows: number | null; detail: string | null; created_at: string }>(result).map((r) => ({
    id: r.id,
    kind: r.kind,
    subject: r.subject ?? undefined,
    affectedRows: r.affected_rows ?? undefined,
    detail: r.detail ?? undefined,
    createdAt: r.created_at,
  }));
}

// Silence unused-import warnings on fs (we use fsp).
void fs;
