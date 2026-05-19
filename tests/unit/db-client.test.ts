import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const originalCwd = process.cwd();
let tmpRoot = "";

beforeEach(async () => {
  vi.resetModules();
  tmpRoot = path.join(os.tmpdir(), `agenticos-db-client-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "vault"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_VAULT_PATH = path.join(tmpRoot, "vault");
  process.env.AGENTICOS_DB_PATH = path.join(tmpRoot, ".agenticos", "agenticos.sqlite");
  delete process.env.AGENTICOS_NATIVE_DB;
});

afterEach(async () => {
  try {
    const { closeDb } = await import("@/lib/db/client");
    await closeDb();
  } catch {}
  process.chdir(originalCwd);
  delete process.env.AGENTICOS_VAULT_PATH;
  delete process.env.AGENTICOS_DB_PATH;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("db/client sqlite recovery", () => {
  it("recovers run history from a temp export when the active DB has no rows", async () => {
    const dbPath = process.env.AGENTICOS_DB_PATH!;
    const client = await import("@/lib/db/client");
    const db = await client.getDb();

    db.run(
      `INSERT INTO runs (
        id, title, prompt, category, status, started_at,
        tokens_estimate, cost_estimate, plan_json,
        files_touched_json, errors_json, created_artifacts_json, artifacts_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        "run_recovered",
        "Recovered run",
        "prove persistence recovery",
        "operations",
        "completed",
        new Date().toISOString(),
        42,
        0.001,
        "{}",
        "[]",
        "[]",
        "[]",
        "[]",
      ],
    );
    await client.saveDbNow();
    await client.closeDb();

    await fs.copyFile(dbPath, `${dbPath}.lost-write.tmp`);
    await fs.writeFile(dbPath, Buffer.alloc(0));

    const recovered = await client.getDb();
    const count = Number(recovered.exec("SELECT COUNT(*) FROM runs")[0]?.values[0]?.[0] ?? 0);
    expect(count).toBe(1);

    const files = await fs.readdir(path.dirname(dbPath));
    expect(files.some((name) => name.endsWith(".bak-empty"))).toBe(true);
  });
});
