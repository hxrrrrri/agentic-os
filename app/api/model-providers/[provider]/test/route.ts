import { NextResponse } from "next/server";
import { getProvider } from "@/lib/agent/providers";
import { isClaudeCliAvailable, isCodexCliAvailable, isCopilotCliAvailable, isGeminiCliAvailable } from "@/lib/agent/cli";

interface TestResult {
  ok: boolean;
  message: string;
}

function json(status: number, body: TestResult) {
  return NextResponse.json(body, { status });
}

async function testOllama(baseUrl: string): Promise<TestResult> {
  try {
    const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store", signal: AbortSignal.timeout(5000) });
    if (!response.ok) return { ok: false, message: `Ollama responded with ${response.status}` };
    return { ok: true, message: "Ollama reachable" };
  } catch {
    return { ok: false, message: "Cannot reach Ollama at http://127.0.0.1:11434" };
  }
}

async function testOpenAI(baseUrl: string, apiKey: string): Promise<TestResult> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      cache: "no-store",
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (response.status === 401) return { ok: false, message: "Invalid API key" };
    if (!response.ok) return { ok: false, message: `API returned ${response.status}` };
    return { ok: true, message: "Connected" };
  } catch {
    return { ok: false, message: "Request failed" };
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);

  if (!provider) {
    return json(404, { ok: false, message: "Unknown provider" });
  }

  if (provider.id === "claude-code") {
    const available = await isClaudeCliAvailable();
    return json(available ? 200 : 503, {
      ok: available,
      message: available ? "Claude CLI found" : "claude not found on PATH — install: npm i -g @anthropic-ai/claude-code",
    });
  }

  if (provider.id === "codex") {
    const available = await isCodexCliAvailable();
    return json(available ? 200 : 503, {
      ok: available,
      message: available ? "Codex CLI found" : "codex not found on PATH — install: npm i -g @openai/codex",
    });
  }

  if (provider.id === "copilot-cli") {
    const available = await isCopilotCliAvailable();
    return json(available ? 200 : 503, {
      ok: available,
      message: available ? "Copilot CLI found" : "copilot not found on PATH - install: npm i -g @github/copilot",
    });
  }

  if (provider.id === "gemini-cli") {
    const available = await isGeminiCliAvailable();
    return json(available ? 200 : 503, {
      ok: available,
      message: available ? "Gemini CLI found" : "gemini not found on PATH — install: npm i -g @google/gemini-cli",
    });
  }

  if (provider.id === "ollama") {
    const result = await testOllama(provider.baseUrl ?? "http://127.0.0.1:11434");
    return json(result.ok ? 200 : 503, result);
  }

  if (provider.id === "nvidia") {
    const apiKey = process.env.NVIDIA_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "NVIDIA_API_KEY not set" });
    const result = await testOpenAI(provider.baseUrl ?? "https://integrate.api.nvidia.com/v1", apiKey);
    return json(result.ok ? 200 : 503, result);
  }

  if (provider.id === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "OPENAI_API_KEY not set" });
    const result = await testOpenAI("https://api.openai.com/v1", apiKey);
    return json(result.ok ? 200 : 503, result);
  }

  if (provider.id === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "ANTHROPIC_API_KEY not set" });
    try {
      const response = await fetch("https://api.anthropic.com/v1/models", {
        cache: "no-store",
        headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
        signal: AbortSignal.timeout(8000),
      });
      if (response.status === 401) return json(401, { ok: false, message: "Invalid API key" });
      if (!response.ok) return json(503, { ok: false, message: `API returned ${response.status}` });
      return json(200, { ok: true, message: "Connected" });
    } catch {
      return json(503, { ok: false, message: "Request failed" });
    }
  }

  if (provider.id === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "GEMINI_API_KEY not set" });
    try {
      const response = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models",
        {
          cache: "no-store",
          headers: { "x-goog-api-key": apiKey },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (response.status === 400 || response.status === 403) return json(403, { ok: false, message: "Invalid API key" });
      if (!response.ok) return json(503, { ok: false, message: `API returned ${response.status}` });
      return json(200, { ok: true, message: "Connected" });
    } catch {
      return json(503, { ok: false, message: "Request failed" });
    }
  }

  if (provider.id === "openrouter") {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "OPENROUTER_API_KEY not set" });
    const result = await testOpenAI("https://openrouter.ai/api/v1", apiKey);
    return json(result.ok ? 200 : 503, result);
  }

  if (provider.id === "grok") {
    const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
    if (!apiKey) return json(401, { ok: false, message: "GROK_API_KEY not set" });
    const result = await testOpenAI("https://api.x.ai/v1", apiKey);
    return json(result.ok ? 200 : 503, result);
  }

  return json(200, { ok: true, message: "Provider registered" });
}
