import { NextResponse } from "next/server";
import { getProvider } from "@/lib/agent/providers";

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

  return json(200, { models: normalizeModels(provider.models ?? [provider.model]) });
}
