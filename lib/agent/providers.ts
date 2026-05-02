import type { ModelEndpoint, ModelProvider } from "@/types";

export const modelEndpoints: ModelEndpoint[] = [
  { id: "claude-code", provider: "claude-code", model: "Claude Code CLI", mode: "cli", enabled: true },
  { id: "codex", provider: "codex", model: "Codex", mode: "cli", enabled: true },
  {
    id: "ollama",
    provider: "ollama",
    model: "llama3.2:latest",
    models: [
      "llama3.2:latest",
      "gpt-oss:120b-cloud",
      "gpt-oss:20b-cloud",
      "deepseek-v3.1:671b-cloud",
      "qwen3-coder:480b-cloud",
      "qwen3-vl:235b-cloud",
      "minimax-m2:cloud",
      "glm-4.6:cloud",
    ],
    baseUrl: "http://127.0.0.1:11434",
    mode: "local",
    enabled: true,
    dynamicModels: true,
  },
  {
    id: "nvidia",
    provider: "nvidia",
    model: "nvidia/llama-3.1-nemotron-ultra-253b-v1",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    mode: "cloud",
    enabled: false,
    dynamicModels: true,
    requiresApiKey: true,
  },
  {
    id: "anthropic",
    provider: "anthropic",
    model: "claude-sonnet-4-5",
    models: ["claude-sonnet-4-5", "claude-opus-4-1", "claude-haiku-4-5"],
    mode: "cloud",
    enabled: false,
    requiresApiKey: true,
  },
  {
    id: "openai",
    provider: "openai",
    model: "gpt-5.2",
    models: ["gpt-5.2", "gpt-5.2-mini", "gpt-5.2-nano", "gpt-4.1"],
    mode: "cloud",
    enabled: false,
    requiresApiKey: true,
  },
  { id: "openrouter", provider: "openrouter", model: "auto", models: ["auto"], mode: "cloud", enabled: false, requiresApiKey: true },
  {
    id: "gemini",
    provider: "gemini",
    model: "gemini-2.5-pro",
    models: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash"],
    mode: "cloud",
    enabled: false,
    requiresApiKey: true,
  },
  { id: "grok", provider: "grok", model: "grok-4", models: ["grok-4", "grok-3"], mode: "cloud", enabled: false, requiresApiKey: true },
  { id: "custom", provider: "custom", model: "custom-endpoint", mode: "cloud", enabled: false },
];

export function listModelProviders() {
  return modelEndpoints;
}

export function getProvider(id: ModelProvider | string) {
  return modelEndpoints.find((endpoint) => endpoint.id === id || endpoint.provider === id);
}
