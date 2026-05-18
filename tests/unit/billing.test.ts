import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = path.join(os.tmpdir(), `agenticos-billing-test-${Date.now()}`);

beforeAll(async () => {
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "vault"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_VAULT_PATH = path.join(tmpRoot, "vault");
  process.env.AGENTICOS_DB_PATH = path.join(tmpRoot, ".agenticos", "agenticos.sqlite");
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("billing/meter", () => {
  it("records usage and aggregates by day", async () => {
    const { recordUsage, getDayUsage } = await import("@/lib/billing/meter");
    await recordUsage({ inputTokens: 100, outputTokens: 50, costUsd: 0.005 });
    await recordUsage({ inputTokens: 200, outputTokens: 100, costUsd: 0.012 });
    const today = await getDayUsage();
    expect(today.runs).toBeGreaterThanOrEqual(2);
    expect(today.tokens).toBeGreaterThanOrEqual(450);
    expect(today.cost).toBeGreaterThan(0.016);
  });

  it("setBudget then enforceBudget rejects when over cap", async () => {
    const { setBudget, enforceBudget } = await import("@/lib/billing/meter");
    await setBudget("day", 0.001); // already over from prior insert
    const verdict = await enforceBudget();
    expect(verdict.allowed).toBe(false);
    if (!verdict.allowed) expect(verdict.reason).toMatch(/day cost cap/i);
  });

  it("setBudget high allows new runs again", async () => {
    const { setBudget, enforceBudget } = await import("@/lib/billing/meter");
    await setBudget("day", 1000);
    const verdict = await enforceBudget();
    expect(verdict.allowed).toBe(true);
  });
});
