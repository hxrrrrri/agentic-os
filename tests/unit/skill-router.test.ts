import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = path.join(os.tmpdir(), `agenticos-router-test-${Date.now()}`);
const originalCwd = process.cwd();

beforeAll(async () => {
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "vault"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_VAULT_PATH = path.join(tmpRoot, "vault");
  process.env.AGENTICOS_DB_PATH = path.join(tmpRoot, ".agenticos", "agenticos.sqlite");
  // Strip provider keys so the LLM tiebreaker path picks no classifier when
  // we don't explicitly stub generateWithModel.
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.OPENAI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
  delete process.env.NVIDIA_API_KEY;
  delete process.env.GROK_API_KEY;
  delete process.env.XAI_API_KEY;
});

afterAll(async () => {
  const { closeDb } = await import("@/lib/db/client");
  await closeDb();
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

beforeEach(async () => {
  // Clear cache between tests so heuristic decisions aren't masked by an
  // earlier cached entry.
  const { clearCache } = await import("@/lib/billing/cache");
  await clearCache();
  vi.restoreAllMocks();
});

describe("skills/router", () => {
  it("routes a carousel prompt to a carousel skill", async () => {
    const { routeSkill } = await import("@/lib/skills/router");
    const out = await routeSkill("carousel of 5 tips for SaaS founders");
    expect(out.skill).toBeDefined();
    expect(out.skill?.id).toMatch(/carousel/);
    expect(out.tokensUsed).toBe(0);
  });

  it("routes an inbox prompt to a Gmail/inbox skill", async () => {
    const { routeSkill } = await import("@/lib/skills/router");
    const out = await routeSkill("summarize my unread emails");
    expect(out.skill).toBeDefined();
    expect(["inbox-digest", "gmail-summary", "inbox-brief", "inbox-triage"]).toContain(out.skill?.id);
  });

  it("returns undefined for a generic short prompt when skip allowed", async () => {
    const { routeSkill } = await import("@/lib/skills/router");
    const out = await routeSkill("what time is it");
    expect(out.skill).toBeUndefined();
  });

  it("does not call the LLM classifier on confident heuristic hits", async () => {
    const llm = await import("@/lib/agent/llm");
    const spy = vi.spyOn(llm, "generateWithModel");
    const { routeSkill } = await import("@/lib/skills/router");
    const out = await routeSkill("carousel design for instagram about onboarding");
    expect(spy).not.toHaveBeenCalled();
    expect(out.tokensUsed).toBe(0);
  });

  it("invokes the LLM classifier only when heuristic is ambiguous", async () => {
    process.env.ANTHROPIC_API_KEY = "sk-test";
    const llm = await import("@/lib/agent/llm");
    const spy = vi.spyOn(llm, "generateWithModel").mockResolvedValue({
      content: "weekly-review",
      usage: { inputTokens: 50, outputTokens: 5 },
    });
    const { routeSkill } = await import("@/lib/skills/router");
    // Ambiguous prompt — touches multiple skills weakly. Force LLM to be sure.
    const out = await routeSkill("compile a weekly overview", { forceLLM: true });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(out.tokensUsed).toBeGreaterThan(0);
    delete process.env.ANTHROPIC_API_KEY;
  });
});
