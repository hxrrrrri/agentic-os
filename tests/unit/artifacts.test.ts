import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { GeneratedArtifact, Skill } from "@/types";
import { buildFallbackArtifactCalls, buildPreflightToolCalls } from "@/lib/agent/artifact-intents";

const originalCwd = process.cwd();
let tmpRoot = "";

function toolSkill(overrides: Partial<Skill> = {}): Skill {
  return {
    id: "carousel-design",
    name: "Carousel Design",
    category: "content",
    description: "Design visual artifacts.",
    template: "Render visual artifacts.",
    requiredIntegrations: [],
    riskLevel: "low",
    outputLocation: "/vault/content",
    enabled: true,
    executionMode: "dry-run",
    useTools: true,
    tools: ["render_carousel", "render_thumbnail"],
    ...overrides,
  };
}

beforeEach(async () => {
  vi.resetModules();
  tmpRoot = path.join(os.tmpdir(), `agenticos-artifacts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  await fs.mkdir(path.join(tmpRoot, "vault"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_VAULT_PATH = path.join(tmpRoot, "vault");
  process.env.AGENTICOS_DB_PATH = path.join(tmpRoot, ".agenticos", "agenticos.sqlite");
});

afterEach(async () => {
  process.chdir(originalCwd);
  delete process.env.AGENTICOS_VAULT_PATH;
  delete process.env.AGENTICOS_DB_PATH;
  await fs.rm(tmpRoot, { recursive: true, force: true });
});

describe("artifact intent fallback", () => {
  it("creates visual fallback tool calls for a tool-enabled carousel skill", () => {
    const calls = buildFallbackArtifactCalls(
      "Make a carousel about SaaS onboarding",
      toolSkill({ tools: ["render_carousel"] }),
      "Onboarding is won before the first login.",
      [],
    );

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("render_carousel");
    expect(calls[0].args.slides).toEqual(expect.any(Array));
  });

  it("does not duplicate an artifact kind that already exists", () => {
    const existing: GeneratedArtifact = {
      id: "artifact_existing",
      kind: "carousel",
      format: "svg",
      path: "attachments/existing.svg",
      title: "Existing",
      mimeType: "image/svg+xml",
      createdAt: new Date().toISOString(),
    };

    const calls = buildFallbackArtifactCalls(
      "Make a carousel about pricing",
      toolSkill({ tools: ["render_carousel"] }),
      "",
      [existing],
    );

    expect(calls).toEqual([]);
  });

  it("preloads Gmail search for Gmail summary skills", () => {
    const calls = buildPreflightToolCalls(
      "Summarize unread Gmail from today",
      toolSkill({
        id: "gmail-summary",
        category: "productivity",
        tools: ["gmail_search", "vault_write_note"],
      }),
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ name: "gmail_search" });
    expect(String(calls[0].args.query)).toContain("is:unread");
    expect(String(calls[0].args.query)).toContain("newer_than:1d");
  });
});

describe("tool-call parsing", () => {
  it("accepts JSON fenced tool calls and removes them from visible output", async () => {
    const { parseToolCalls, stripToolCalls } = await import("@/lib/agent/tool-loop");
    const text = 'Intro\n```json\n{"name":"render_thumbnail","args":{"title":"Launch Plan"}}\n```\nDone';
    expect(parseToolCalls(text)).toEqual([
      { name: "render_thumbnail", args: { title: "Launch Plan" }, raw: '```json\n{"name":"render_thumbnail","args":{"title":"Launch Plan"}}\n```' },
    ]);
    expect(stripToolCalls(text)).toBe("Intro\n\nDone");
  });
});

describe("carousel rendering", () => {
  it("embeds slide SVGs in the HTML preview so API-served previews render", async () => {
    const { renderCarousel } = await import("@/lib/artifacts");
    const { resolveVaultPath } = await import("@/lib/vault/service");

    const artifacts = await renderCarousel(
      {
        title: "Onboarding Carousel",
        aspect: "4:5",
        slides: [
          { title: "Start Here", body: "Show value before setup." },
          { title: "One Win", body: "Give the user one visible result." },
          { title: "Next Step", body: "Ask for one action only." },
        ],
      },
      { runId: "run_test" },
    );

    const html = artifacts.find((artifact) => artifact.format === "html");
    expect(html).toBeDefined();
    const raw = await fs.readFile(resolveVaultPath(html!.path), "utf8");
    expect(raw).toContain("data:image/svg+xml;base64,");
  });
});
