#!/usr/bin/env node
/**
 * AgenticOS local backup.
 *
 * Copies:
 *   - .agenticos/agenticos.sqlite (run history, approvals, memory index, etc.)
 *   - vault/ (markdown artifacts)
 *
 * Into a timestamped folder under `backups/` at the repo root.
 *
 * Usage:
 *   node scripts/backup.mjs                    # default backups/ folder
 *   AGENTICOS_BACKUP_DIR=D:/backups node scripts/backup.mjs
 *   node scripts/backup.mjs --keep 7           # prune older than 7 backups
 */

import { mkdir, copyFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const dbPath =
  process.env.AGENTICOS_DB_PATH ?? path.join(repoRoot, ".agenticos", "agenticos.sqlite");
const vaultPath = process.env.AGENTICOS_VAULT_PATH ?? path.join(repoRoot, "vault");
const backupDir = process.env.AGENTICOS_BACKUP_DIR ?? path.join(repoRoot, "backups");

const keepIdx = process.argv.indexOf("--keep");
const keep = keepIdx > -1 ? Math.max(1, parseInt(process.argv[keepIdx + 1] ?? "0", 10) || 0) : 0;

const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
const target = path.join(backupDir, stamp);

async function copyTree(src, dst) {
  let entries;
  try {
    entries = await readdir(src, { withFileTypes: true });
  } catch {
    return;
  }
  await mkdir(dst, { recursive: true });
  for (const entry of entries) {
    if (entry.name === ".obsidian" || entry.name.startsWith(".git")) continue;
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) await copyTree(s, d);
    else if (entry.isFile()) await copyFile(s, d);
  }
}

async function pruneOld() {
  if (!keep) return;
  let entries;
  try {
    entries = await readdir(backupDir, { withFileTypes: true });
  } catch {
    return;
  }
  const dirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();
  const toDelete = dirs.slice(keep);
  for (const name of toDelete) {
    const full = path.join(backupDir, name);
    await rm(full, { recursive: true, force: true });
    console.log(`pruned ${full}`);
  }
}

async function main() {
  await mkdir(target, { recursive: true });

  let copiedDb = false;
  try {
    await stat(dbPath);
    await copyFile(dbPath, path.join(target, "agenticos.sqlite"));
    copiedDb = true;
  } catch {
    console.warn(`db not found at ${dbPath} — skipping`);
  }

  let copiedVault = false;
  try {
    await stat(vaultPath);
    await copyTree(vaultPath, path.join(target, "vault"));
    copiedVault = true;
  } catch {
    console.warn(`vault not found at ${vaultPath} — skipping`);
  }

  if (!copiedDb && !copiedVault) {
    await rm(target, { recursive: true, force: true });
    console.error("nothing to back up");
    process.exit(1);
  }

  await pruneOld();
  console.log(`backup → ${target}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
