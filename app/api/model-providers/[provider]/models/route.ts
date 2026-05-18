import { NextResponse } from "next/server";
import { getProvider } from "@/lib/agent/providers";
import { isClaudeCliAvailable, isCodexCliAvailable, isCopilotCliAvailable, isGeminiCliAvailable, listCopilotCliModels } from "@/lib/agent/cli";
import { getSecret } from "@/lib/secrets/store";

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

interface OpenAIModelsResponse {
  data?: Array<{ id?: string }>;
}

function json(status: number, body: { models: string[]; error?: string }) {
  return NextResponse.json(body, { status });
}

function normalizeModels(models: Array<string | undefined>) {
  return Array.from(
    new Set(
      models
        .map((model) => model?.trim())
        .filter((model): model is string => Boolean(model)),
    ),
  ).sort((a, b) => a.localeCompare(b));
}

function orderedModels(primary: string[], fallback: string[]) {
  return Array.from(new Set([...primary, ...fallback].map((model) => model.trim()).filter(Boolean)));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) {
    return json(404, { models: [], error: "Unknown model provider." });
  }

  if (provider.id === "ollama") {
    try {
      const response = await fetch(`${provider.baseUrl}/api/tags`, { cache: "no-store" });

      if (!response.ok) {
        return json(response.status, { models: [], error: "Ollama model list is unavailable." });
      }

      const body = (await response.json()) as OllamaTagsResponse;
      const models = normalizeModels([
        ...(provider.models ?? []),
        ...(body.models ?? []).map((model) => model.name ?? model.model),
      ]);

      return json(200, { models });
    } catch {
      return json(503, { models: [], error: "Could not reach Ollama at http://127.0.0.1:11434." });
    }
  }

  if (provider.id === "nvidia") {
    const apiKey = process.env.NVIDIA_API_KEY;

    if (!apiKey) {
      return json(401, { models: [], error: "NVIDIA_API_KEY is not configured." });
    }

    try {
      const response = await fetch(`${provider.baseUrl}/models`, {
        cache: "no-store",
        headers: { Authorization: `Bearer ${apiKey}` },
      });

      if (!response.ok) {
        return json(response.status, { models: [], error: "NVIDIA model list is unavailable." });
      }

      const body = (await response.json()) as OpenAIModelsResponse;
      const models = normalizeModels((body.data ?? []).map((model) => model.id));

      return json(200, { models });
    } catch {
      return json(503, { models: [], error: "Could not reach NVIDIA NIM model catalog." });
    }
  }

  if (provider.id === "claude-code") {
    const available = await isClaudeCliAvailable();
    if (!available) {
      return json(503, {
        models: normalizeModels(provider.models ?? [provider.model]),
        error: "Claude CLI not found on PATH. Install with: npm install -g @anthropic-ai/claude-code",
      });
    }
    return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
  }

  if (provider.id === "codex") {
    const available = await isCodexCliAvailable();
    if (!available) {
      return json(503, {
        models: normalizeModels(provider.models ?? [provider.model]),
        error: "Codex CLI not found on PATH. Install with: npm install -g @openai/codex",
      });
    }
    return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
  }

  if (provider.id === "copilot-cli") {
    const available = await isCopilotCliAvailable();
    if (!available) {
      return json(503, {
        models: normalizeModels(provider.models ?? [provider.model]),
        error: "Copilot CLI not found on PATH. Install with: npm install -g @github/copilot",
      });
    }
    try {
      return json(200, { models: orderedModels(await listCopilotCliModels(), provider.models ?? [provider.model]) });
    } catch {
      return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
    }
  }

  if (provider.id === "gemini-cli") {
    const available = await isGeminiCliAvailable();
    if (!available) {
      return json(503, {
        models: normalizeModels(provider.models ?? [provider.model]),
        error: "Gemini CLI not found on PATH. Install with: npm install -g @google/gemini-cli",
      });
    }
    return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
  }

  if (provider.id === "openai") {
    const apiKey = (await getSecret("OPENAI_API_KEY")) ?? process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(401, { models: normalizeModels(provider.models ?? [provider.model]), error: "OPENAI_API_KEY is not configured." });
    }
    try {
      const response = await fetch("https://api.openai.com/v1/models", {
        cache: "no-store",
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      if (!response.ok) {
        return json(response.status, { models: normalizeModels(provider.models ?? [provider.model]), error: "OpenAI model list unavailable." });
      }
      const body = (await response.json()) as OpenAIModelsResponse;
      const ids = (body.data ?? [])
        .map((m) => m.id)
        .filter((id): id is string => typeof id === "string")
        .filter((id) => /^(gpt-|o[1-9]|chatgpt)/.test(id));
      return json(200, { models: orderedModels(ids, provider.models ?? [provider.model]) });
    } catch {
      return json(503, { models: normalizeModels(provider.models ?? [provider.model]), error: "Could not reach OpenAI." });
    }
  }

  if (provider.id === "anthropic") {
    const apiKey = (await getSecret("ANTHROPIC_API_KEY")) ?? process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return json(401, { models: normalizeModels(provider.models ?? [provider.model]), error: "ANTHROPIC_API_KEY is not configured." });
    }
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        cache: "no-store",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      });
      if (!response.ok) {
        return json(response.status, { models: normalizeModels(provider.models ?? [provider.model]), error: "Anthropic model list unavailable." });
      }
      const body = (await response.json()) as { data?: Array<{ id?: string }> };
      const ids = (body.data ?? []).map((m) => m.id).filter((id): id is string => typeof id === "string");
      return json(200, { models: orderedModels(ids, provider.models ?? [provider.model]) });
    } catch {
      return json(503, { models: normalizeModels(provider.models ?? [provider.model]), error: "Could not reach Anthropic." });
    }
  }

  return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
}
