import { getProvider } from "@/lib/agent/providers";
import {
  isClaudeCliAvailable,
  isCodexCliAvailable,
  isCopilotCliAvailable,
  isGeminiCliAvailable,
  listClaudeCliEfforts,
  listClaudeCliModels,
  listCodexCliModelCatalog,
  listCopilotCliEfforts,
  listCopilotCliModels,
} from "@/lib/agent/cli";
import { getSecret } from "@/lib/secrets/store";
import type { ModelEndpoint, ReasoningEffort, ThinkingLevel } from "@/types";

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

export interface ProviderModelsResult {
  models: string[];
  error?: string;
  reasoningEfforts?: ReasoningEffort[];
  reasoningEffortsByModel?: Record<string, ReasoningEffort[]>;
  thinkingLevels?: ThinkingLevel[];
}

export interface ProviderTestResult {
  ok: boolean;
  message: string;
}

export function normalizeModels(models: Array<string | undefined>) {
  return Array.from(
    new Set(
      models
        .map((model) => model?.trim())
        .filter((model): model is string => Boolean(model)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function orderedModels(primary: string[], fallback: string[]) {
  return Array.from(new Set((primary.length ? primary : fallback).map((model) => model.trim()).filter(Boolean)));
}

function fallbackModels(provider: ModelEndpoint) {
  return normalizeModels(provider.models ?? [provider.model]);
}

function fallbackCapabilities(provider: ModelEndpoint): Pick<ProviderModelsResult, "reasoningEfforts" | "thinkingLevels"> {
  return {
    reasoningEfforts: provider.reasoningEfforts,
    thinkingLevels: provider.thinkingLevels,
  };
}

async function providerSecret(providerId: string): Promise<string | undefined> {
  const envByProvider: Record<string, string[]> = {
    nvidia: ["NVIDIA_API_KEY"],
    openai: ["OPENAI_API_KEY"],
    anthropic: ["ANTHROPIC_API_KEY"],
    gemini: ["GEMINI_API_KEY"],
    openrouter: ["OPENROUTER_API_KEY"],
    grok: ["GROK_API_KEY", "XAI_API_KEY"],
  };
  for (const key of envByProvider[providerId] ?? []) {
    const stored = await getSecret(key).catch(() => null);
    const value = stored ?? process.env[key];
    if (value) return value;
  }
  return undefined;
}

async function fetchOpenAICompatibleModels(
  baseUrl: string,
  apiKey: string,
  provider: ModelEndpoint,
  filter?: (id: string) => boolean,
): Promise<ProviderModelsResult> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      return { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: `Model list unavailable (${response.status}).` };
    }
    const body = (await response.json()) as OpenAIModelsResponse;
    const ids = (body.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string")
      .filter((id) => (filter ? filter(id) : true));
    return { models: orderedModels(ids, provider.models ?? [provider.model]), ...fallbackCapabilities(provider) };
  } catch {
    return { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "Could not reach model catalog." };
  }
}

export async function listProviderModels(providerId: string): Promise<{ status: number; body: ProviderModelsResult }> {
  const provider = getProvider(providerId);
  if (!provider) return { status: 404, body: { models: [], error: "Unknown model provider." } };

  if (provider.id === "ollama") {
    try {
      const response = await fetch(`${provider.baseUrl}/api/tags`, {
        cache: "no-store",
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "Ollama model list is unavailable." } };
      }
      const body = (await response.json()) as OllamaTagsResponse;
      const localModels = normalizeModels((body.models ?? []).map((model) => model.name ?? model.model));
      return {
        status: 200,
        body: {
          models: localModels.length ? localModels : fallbackModels(provider),
          ...fallbackCapabilities(provider),
        },
      };
    } catch {
      return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "Could not reach Ollama at http://127.0.0.1:11434." } };
    }
  }

  if (provider.id === "claude-code") {
    const available = await isClaudeCliAvailable();
    return {
      status: 200,
      body: {
        models: available ? orderedModels(await listClaudeCliModels().catch(() => []), provider.models ?? [provider.model]) : fallbackModels(provider),
        reasoningEfforts: available ? await listClaudeCliEfforts().catch(() => provider.reasoningEfforts) : provider.reasoningEfforts,
        error: available ? undefined : "Claude CLI not found on PATH. Install with: npm install -g @anthropic-ai/claude-code",
      },
    };
  }

  if (provider.id === "codex") {
    const available = await isCodexCliAvailable();
    if (available) {
      try {
        const catalog = await listCodexCliModelCatalog();
        return {
          status: 200,
          body: {
            models: orderedModels(catalog.models, provider.models ?? [provider.model]),
            reasoningEfforts: catalog.reasoningEfforts ?? provider.reasoningEfforts,
            reasoningEffortsByModel: catalog.reasoningEffortsByModel,
          },
        };
      } catch {
        // Fall through to the static fallback with the availability status preserved.
      }
    }
    return {
      status: 200,
      body: {
        models: fallbackModels(provider),
        ...fallbackCapabilities(provider),
        error: available ? undefined : "Codex CLI not found on PATH. Install with: npm install -g @openai/codex",
      },
    };
  }

  if (provider.id === "copilot-cli") {
    const available = await isCopilotCliAvailable();
    if (!available) {
      return {
        status: 200,
        body: {
          models: fallbackModels(provider),
          ...fallbackCapabilities(provider),
          error: "Copilot CLI not found on PATH. Install with: npm install -g @github/copilot",
        },
      };
    }
    try {
      return {
        status: 200,
        body: {
          models: orderedModels(await listCopilotCliModels(), provider.models ?? [provider.model]),
          reasoningEfforts: await listCopilotCliEfforts().catch(() => provider.reasoningEfforts),
        },
      };
    } catch {
      return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider) } };
    }
  }

  if (provider.id === "gemini-cli") {
    const available = await isGeminiCliAvailable();
    return {
      status: 200,
      body: {
        models: fallbackModels(provider),
        ...fallbackCapabilities(provider),
        error: available ? undefined : "Gemini CLI not found on PATH. Install with: npm install -g @google/gemini-cli",
      },
    };
  }

  if (provider.id === "openai") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "OPENAI_API_KEY is not configured." } };
    return {
      status: 200,
      body: await fetchOpenAICompatibleModels(
        "https://api.openai.com/v1",
        apiKey,
        provider,
        (id) => /^(gpt-|o[1-9]|chatgpt)/.test(id),
      ),
    };
  }

  if (provider.id === "nvidia") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "NVIDIA_API_KEY is not configured." } };
    return {
      status: 200,
      body: await fetchOpenAICompatibleModels(provider.baseUrl ?? "https://integrate.api.nvidia.com/v1", apiKey, provider),
    };
  }

  if (provider.id === "openrouter") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "OPENROUTER_API_KEY is not configured." } };
    return {
      status: 200,
      body: await fetchOpenAICompatibleModels("https://openrouter.ai/api/v1", apiKey, provider),
    };
  }

  if (provider.id === "grok") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "GROK_API_KEY or XAI_API_KEY is not configured." } };
    return {
      status: 200,
      body: await fetchOpenAICompatibleModels("https://api.x.ai/v1", apiKey, provider),
    };
  }

  if (provider.id === "anthropic") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "ANTHROPIC_API_KEY is not configured." } };
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        cache: "no-store",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: `Anthropic model list unavailable (${response.status}).` } };
      }
      const body = (await response.json()) as { data?: Array<{ id?: string }> };
      const ids = (body.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string");
      return { status: 200, body: { models: orderedModels(ids, provider.models ?? [provider.model]), ...fallbackCapabilities(provider) } };
    } catch {
      return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "Could not reach Anthropic." } };
    }
  }

  if (provider.id === "gemini") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "GEMINI_API_KEY is not configured." } };
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        cache: "no-store",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: `Gemini model list unavailable (${response.status}).` } };
      }
      const body = (await response.json()) as { models?: Array<{ name?: string; supportedGenerationMethods?: string[] }> };
      const ids = (body.models ?? [])
        .filter((model) => model.supportedGenerationMethods?.includes("generateContent"))
        .map((model) => model.name?.replace(/^models\//, ""))
        .filter((id): id is string => typeof id === "string");
      return { status: 200, body: { models: orderedModels(ids, provider.models ?? [provider.model]), ...fallbackCapabilities(provider) } };
    } catch {
      return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider), error: "Could not reach Gemini." } };
    }
  }

  return { status: 200, body: { models: fallbackModels(provider), ...fallbackCapabilities(provider) } };
}

async function testOpenAICompatible(baseUrl: string, apiKey: string): Promise<ProviderTestResult> {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/models`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401 || response.status === 403) return { ok: false, message: "Invalid API key" };
    if (!response.ok) return { ok: false, message: `API returned ${response.status}` };
    return { ok: true, message: "Connected" };
  } catch {
    return { ok: false, message: "Request failed" };
  }
}

export async function testProviderConnection(providerId: string): Promise<{ status: number; body: ProviderTestResult }> {
  const provider = getProvider(providerId);
  if (!provider) return { status: 404, body: { ok: false, message: "Unknown provider" } };

  if (provider.id === "claude-code") {
    const available = await isClaudeCliAvailable();
    return { status: available ? 200 : 503, body: { ok: available, message: available ? "Claude CLI found" : "claude not found on PATH - install: npm i -g @anthropic-ai/claude-code" } };
  }
  if (provider.id === "codex") {
    const available = await isCodexCliAvailable();
    return { status: available ? 200 : 503, body: { ok: available, message: available ? "Codex CLI found" : "codex not found on PATH - install: npm i -g @openai/codex" } };
  }
  if (provider.id === "copilot-cli") {
    const available = await isCopilotCliAvailable();
    return { status: available ? 200 : 503, body: { ok: available, message: available ? "Copilot CLI found" : "copilot not found on PATH - install: npm i -g @github/copilot" } };
  }
  if (provider.id === "gemini-cli") {
    const available = await isGeminiCliAvailable();
    return { status: available ? 200 : 503, body: { ok: available, message: available ? "Gemini CLI found" : "gemini not found on PATH - install: npm i -g @google/gemini-cli" } };
  }
  if (provider.id === "ollama") {
    try {
      const response = await fetch(`${provider.baseUrl}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
      return { status: response.ok ? 200 : 503, body: { ok: response.ok, message: response.ok ? "Ollama reachable" : `Ollama responded with ${response.status}` } };
    } catch {
      return { status: 503, body: { ok: false, message: "Cannot reach Ollama at http://127.0.0.1:11434" } };
    }
  }

  if (provider.id === "openai" || provider.id === "nvidia" || provider.id === "openrouter" || provider.id === "grok") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 401, body: { ok: false, message: `${provider.id.toUpperCase()} API key is not set` } };
    const baseUrl =
      provider.id === "openai" ? "https://api.openai.com/v1"
      : provider.id === "openrouter" ? "https://openrouter.ai/api/v1"
      : provider.id === "grok" ? "https://api.x.ai/v1"
      : provider.baseUrl ?? "https://integrate.api.nvidia.com/v1";
    const result = await testOpenAICompatible(baseUrl, apiKey);
    return { status: result.ok ? 200 : 503, body: result };
  }

  if (provider.id === "anthropic") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 401, body: { ok: false, message: "ANTHROPIC_API_KEY not set" } };
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        cache: "no-store",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401 || response.status === 403) return { status: 401, body: { ok: false, message: "Invalid API key" } };
      if (!response.ok) return { status: 503, body: { ok: false, message: `API returned ${response.status}` } };
      return { status: 200, body: { ok: true, message: "Connected" } };
    } catch {
      return { status: 503, body: { ok: false, message: "Request failed" } };
    }
  }

  if (provider.id === "gemini") {
    const apiKey = await providerSecret(provider.id);
    if (!apiKey) return { status: 401, body: { ok: false, message: "GEMINI_API_KEY not set" } };
    try {
      const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models", {
        cache: "no-store",
        headers: { "x-goog-api-key": apiKey },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 400 || response.status === 403) return { status: 403, body: { ok: false, message: "Invalid API key" } };
      if (!response.ok) return { status: 503, body: { ok: false, message: `API returned ${response.status}` } };
      return { status: 200, body: { ok: true, message: "Connected" } };
    } catch {
      return { status: 503, body: { ok: false, message: "Request failed" } };
    }
  }

  return { status: 200, body: { ok: true, message: "Provider registered" } };
}
