import type { ModelEndpoint, ModelProvider } from "@/types";

export const modelEndpoints: ModelEndpoint[] = [
  { id: "claude-code", provider: "claude-code", model: "Claude Code CLI", mode: "cli", enabled: true },
  { id: "codex", provider: "codex", model: "Codex", mode: "cli", enabled: true },
  { id: "ollama-local", provider: "ollama", model: "llama3.2:latest", baseUrl: "http://localhost:11434", mode: "local", enabled: true },
  { id: "openai", provider: "openai", model: "gpt-5.2", mode: "cloud", enabled: false },
  { id: "openrouter", provider: "openrouter", model: "auto", mode: "cloud", enabled: false },
  { id: "gemini", provider: "gemini", model: "gemini-pro", mode: "cloud", enabled: false },
  { id: "grok", provider: "grok", model: "grok", mode: "cloud", enabled: false },
  { id: "custom", provider: "custom", model: "custom-endpoint", mode: "cloud", enabled: false },
];

export function listModelProviders() {
  return modelEndpoints;
}

export function getProvider(id: ModelProvider | string) {
  return modelEndpoints.find((endpoint) => endpoint.id === id || endpoint.provider === id);
}
