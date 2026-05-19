import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = path.join(os.tmpdir(), `agenticos-router-test-${Date.now()}`);
const ctxRoot = path.join(tmpRoot, ".agenticos-project");
const originalCwd = process.cwd();

beforeAll(async () => {
  await fs.mkdir(path.join(ctxRoot, "rules"), { recursive: true });
  await fs.writeFile(path.join(ctxRoot, "project.md"), "# Project\n\nBaseline.\n", "utf8");
  await fs.writeFile(path.join(ctxRoot, "rules", "stripe.md"), "# Stripe rule\n\nNever auto-refund.\n", "utf8");
  await fs.writeFile(path.join(ctxRoot, "rules", "youtube.md"), "# YouTube rule\n\nHook in 3s.\n", "utf8");
  process.chdir(tmpRoot);
  process.env.AGENTICOS_PROJECT_CONTEXT_PATH = ctxRoot;
});

afterAll(async () => {
  process.chdir(originalCwd);
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("project-context router", () => {
  it("prioritizes business-tagged rules when category=business", async () => {
    const { loadProjectModelContext } = await import("@/lib/agent/project-context");
    const rendered = await loadProjectModelContext({ category: "business" });
    const stripeIdx = rendered.indexOf("stripe.md");
    const ytIdx = rendered.indexOf("youtube.md");
    expect(stripeIdx).toBeGreaterThan(-1);
    expect(ytIdx).toBeGreaterThan(-1);
    expect(stripeIdx).toBeLessThan(ytIdx);
  });

  it("prioritizes content-tagged rules when category=content", async () => {
    const { loadProjectModelContext } = await import("@/lib/agent/project-context");
    const rendered = await loadProjectModelContext({ category: "content" });
    const stripeIdx = rendered.indexOf("stripe.md");
    const ytIdx = rendered.indexOf("youtube.md");
    expect(ytIdx).toBeLessThan(stripeIdx);
  });

  it("renders the category in the header", async () => {
    const { loadProjectModelContext } = await import("@/lib/agent/project-context");
    const rendered = await loadProjectModelContext({ category: "research" });
    expect(rendered).toContain("routed for category: research");
  });
});
