/**
 * better-sqlite3 adapter that mirrors the sql.js Database surface our
 * repositories rely on (`run`, `exec`, `export`, `close`). Opt-in via
 * AGENTICOS_NATIVE_DB=1 — when unset (or when better-sqlite3 isn't installed),
 * the original sql.js path stays in use.
 *
 * `db.exec(sql, params)` in sql.js returns
 *   Array<{ columns: string[]; values: unknown[][] }>
 * and we keep that shape so existing call sites work unchanged.
 *
 * Why opt-in: better-sqlite3 is a native module — requires either a prebuilt
 * binary for your Node ABI or `node-gyp` rebuild. We never want `npm install`
 * to fail because of it, so it's loaded dynamically and falls back if absent.
 */

import fs from "node:fs";
import path from "node:path";

interface SqlJsLikeDatabase {
  run(sql: string, params?: Array<string | number | null>): void;
  exec(sql: string, params?: Array<string | number | null>): Array<{ columns: string[]; values: unknown[][] }>;
  export(): Uint8Array;
  close(): void;
}

// Minimal subset of better-sqlite3 we depend on.
interface BetterStatement {
  run(...params: unknown[]): unknown;
  all(...params: unknown[]): unknown[];
  columns(): Array<{ name: string }>;
  raw(toggle?: boolean): BetterStatement;
  reader: boolean;
}

interface BetterDatabase {
  prepare(sql: string): BetterStatement;
  exec(sql: string): void;
  serialize(): Buffer;
  close(): void;
  pragma(sql: string, options?: { simple?: boolean }): unknown;
}

interface BetterCtor {
  new (filename: string, options?: { fileMustExist?: boolean }): BetterDatabase;
}

function loadBetterSqlite(): BetterCtor | null {
  try {
    // Keep this out of Turbopack's static module graph. better-sqlite3 is an
    // optional native dependency used only when AGENTICOS_NATIVE_DB=1.
    const runtimeRequire = eval("require") as NodeRequire;
    const packageName = "better-sqlite3";
    const resolved = runtimeRequire.resolve(packageName);
    if (!resolved) return null;
    return runtimeRequire(packageName) as BetterCtor;
  } catch {
    return null;
  }
}

export function isNativeAvailable(): boolean {
  if (process.env.AGENTICOS_NATIVE_DB !== "1") return false;
  return loadBetterSqlite() !== null;
}

/**
 * Splits a multi-statement SQL string at `;` boundaries, respecting strings
 * and comments. better-sqlite3.exec runs many at once but `.prepare` cannot,
 * so for ad-hoc `.exec(sql)` calls we hand the whole blob to better's exec.
 */

function isSelect(sql: string): boolean {
  return /^\s*(select|with|pragma|values|explain)/i.test(sql);
}

export function openNativeDb(filePath: string): SqlJsLikeDatabase {
  const Ctor = loadBetterSqlite();
  if (!Ctor) throw new Error("better-sqlite3 is not installed");
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const inner = new Ctor(filePath);
  inner.pragma("journal_mode = WAL");
  inner.pragma("synchronous = NORMAL");
  inner.pragma("foreign_keys = ON");

  const wrap: SqlJsLikeDatabase = {
    run(sql, params = []) {
      // Multi-statement schema DDL goes straight to .exec.
      if (/;/.test(sql.trim().slice(0, -1)) && params.length === 0) {
        inner.exec(sql);
        return;
      }
      inner.prepare(sql).run(...params);
    },
    exec(sql, params = []) {
      const trimmed = sql.trim();
      if (params.length === 0 && (/;[^']*$/.test(trimmed) || !isSelect(trimmed))) {
        // Mixed schema / non-SELECT block — defer to native exec, no rows.
        if (isSelect(trimmed)) {
          const stmt = inner.prepare(trimmed);
          const cols = stmt.columns().map((c) => c.name);
          const rows = stmt.raw(true).all() as unknown[][];
          return [{ columns: cols, values: rows }];
        }
        inner.exec(trimmed);
        return [];
      }
      if (!isSelect(trimmed)) {
        inner.prepare(trimmed).run(...params);
        return [];
      }
      const stmt = inner.prepare(trimmed);
      const cols = stmt.columns().map((c) => c.name);
      const rows = stmt.raw(true).all(...params) as unknown[][];
      return [{ columns: cols, values: rows }];
    },
    export() {
      return new Uint8Array(inner.serialize());
    },
    close() {
      inner.close();
    },
  };

  return wrap;
}
