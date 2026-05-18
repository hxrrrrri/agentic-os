import { NextResponse } from "next/server";
import { listModelProviders } from "@/lib/agent/providers";
import { isClaudeCliAvailable, isCodexCliAvailable, isCopilotCliAvailable, isGeminiCliAvailable } from "@/lib/agent/cli";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ProviderHealth {
  id: string;
  status: "ok" | "missing-key" | "unreachable" | "cli-missing" | "skipped";
  message: string;
  durationMs: number;
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const start = Date.now();
  try {
    const result = await fn();
    return [result, Date.now() - start];
  } catch {
    return [null as unknown as T, Date.now() - start];
  }
}

async function probeCloud(url: string, headers: Record<string, string>): Promise<boolean> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(6_000), cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

async function probeProvider(providerId: string): Promise<ProviderHealth> {
  const start = Date.now();
  const elapsed = () => Date.now() - start;

  switch (providerId) {
    case "claude-code": {
      const [ok, ms] = await timed(isClaudeCliAvailable);
      return { id: providerId, status: ok ? "ok" : "cli-missing", message: ok ? "claude CLI on PATH" : "claude not found", durationMs: ms };
    }
    case "codex": {
      const [ok, ms] = await timed(isCodexCliAvailable);
      return { id: providerId, status: ok ? "ok" : "cli-missing", message: ok ? "codex CLI on PATH" : "codex not found", durationMs: ms };
    }
    case "copilot-cli": {
      const [ok, ms] = await timed(isCopilotCliAvailable);
      return { id: providerId, status: ok ? "ok" : "cli-missing", message: ok ? "copilot CLI on PATH" : "copilot not found", durationMs: ms };
    }
    case "gemini-cli": {
      const [ok, ms] = await timed(isGeminiCliAvailable);
      return { id: providerId, status: ok ? "ok" : "cli-missing", message: ok ? "gemini CLI on PATH" : "gemini not found", durationMs: ms };
    }
    case "ollama": {
      const ok = await probeCloud("http://127.0.0.1:11434/api/tags", {});
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "ollama responding" : "no daemon at :11434", durationMs: elapsed() };
    }
    case "openai": {
      const key = process.env.OPENAI_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "OPENAI_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://api.openai.com/v1/models", { Authorization: `Bearer ${key}` });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "openai api ok" : "openai api error", durationMs: elapsed() };
    }
    case "anthropic": {
      const key = process.env.ANTHROPIC_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "ANTHROPIC_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://api.anthropic.com/v1/models", { "x-api-key": key, "anthropic-version": "2023-06-01" });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "anthropic api ok" : "anthropic api error", durationMs: elapsed() };
    }
    case "openrouter": {
      const key = process.env.OPENROUTER_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "OPENROUTER_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://openrouter.ai/api/v1/models", { Authorization: `Bearer ${key}` });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "openrouter ok" : "openrouter error", durationMs: elapsed() };
    }
    case "gemini": {
      const key = process.env.GEMINI_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "GEMINI_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://generativelanguage.googleapis.com/v1beta/models", { "x-goog-api-key": key });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "gemini ok" : "gemini error", durationMs: elapsed() };
    }
    case "grok": {
      const key = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "GROK_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://api.x.ai/v1/models", { Authorization: `Bearer ${key}` });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "grok ok" : "grok error", durationMs: elapsed() };
    }
    case "nvidia": {
      const key = process.env.NVIDIA_API_KEY;
      if (!key) return { id: providerId, status: "missing-key", message: "NVIDIA_API_KEY not set", durationMs: 0 };
      const ok = await probeCloud("https://integrate.api.nvidia.com/v1/models", { Authorization: `Bearer ${key}` });
      return { id: providerId, status: ok ? "ok" : "unreachable", message: ok ? "nvidia ok" : "nvidia error", durationMs: elapsed() };
    }
    default:
      return { id: providerId, status: "skipped", message: "no probe implemented", durationMs: 0 };
  }
}

export async function GET() {
  const providers = listModelProviders().filter((p) => p.id !== "custom");
  const checks = await Promise.all(providers.map((p) => probeProvider(p.id)));
  const summary = {
    okCount: checks.filter((c) => c.status === "ok").length,
    totalCount: checks.length,
    generatedAt: new Date().toISOString(),
  };
  return NextResponse.json({ summary, providers: checks });
}
