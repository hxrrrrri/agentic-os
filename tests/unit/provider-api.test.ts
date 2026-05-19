import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/secrets/store", () => ({
  getSecret: vi.fn(async () => null),
}));

vi.mock("@/lib/agent/cli", () => ({
  isClaudeCliAvailable: vi.fn(async () => false),
  isCodexCliAvailable: vi.fn(async () => false),
  isCopilotCliAvailable: vi.fn(async () => false),
  isGeminiCliAvailable: vi.fn(async () => false),
  listClaudeCliEfforts: vi.fn(async () => []),
  listClaudeCliModels: vi.fn(async () => []),
  listCodexCliModelCatalog: vi.fn(async () => ({ models: [] })),
  listCopilotCliEfforts: vi.fn(async () => []),
  listCopilotCliModels: vi.fn(async () => []),
}));

const MODEL_ENV_KEYS = [
  "NVIDIA_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "OPENROUTER_API_KEY",
  "GROK_API_KEY",
  "XAI_API_KEY",
];

describe("agent/provider-api", () => {
  beforeEach(() => {
    for (const key of MODEL_ENV_KEYS) delete process.env[key];
  });

  it("returns fallback models with an error instead of failing when a cloud key is missing", async () => {
    const { listProviderModels } = await import("@/lib/agent/provider-api");
    const result = await listProviderModels("openai");

    expect(result.status).toBe(200);
    expect(result.body.models).toContain("gpt-5.5");
    expect(result.body.error).toContain("OPENAI_API_KEY");
  });

  it("uses the stable provider id contract for unknown provider errors", async () => {
    const { testProviderConnection } = await import("@/lib/agent/provider-api");
    const result = await testProviderConnection("missing-provider");

    expect(result.status).toBe(404);
    expect(result.body).toEqual({ ok: false, message: "Unknown provider" });
  });

  it("uses Codex CLI model metadata instead of appending stale fallback models", async () => {
    const cli = await import("@/lib/agent/cli");
    vi.mocked(cli.isCodexCliAvailable).mockResolvedValueOnce(true);
    vi.mocked(cli.listCodexCliModelCatalog).mockResolvedValueOnce({
      models: ["gpt-5.2"],
      reasoningEfforts: ["low", "medium"],
      reasoningEffortsByModel: { "gpt-5.2": ["low", "medium"] },
    });

    const { listProviderModels } = await import("@/lib/agent/provider-api");
    const result = await listProviderModels("codex");

    expect(result.body.models).toEqual(["gpt-5.2"]);
    expect(result.body.reasoningEffortsByModel?.["gpt-5.2"]).toEqual(["low", "medium"]);
  });

  it("marks Gemini and Grok as dynamically refreshable providers", async () => {
    const { getProvider } = await import("@/lib/agent/providers");

    expect(getProvider("gemini")?.dynamicModels).toBe(true);
    expect(getProvider("grok")?.dynamicModels).toBe(true);
  });
});
