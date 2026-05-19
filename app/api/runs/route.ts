import { NextResponse } from "next/server";
import { z } from "zod";
import { startRun } from "@/lib/agent/engine";
import { listRuns } from "@/lib/db/repositories";
import { listModelProviders } from "@/lib/agent/providers";
import type { ModelEndpoint, ReasoningEffort, SelectedModelProfile } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

const RunRequestSchema = z.object({
  prompt: z.string().min(1),
  skillId: z.string().optional(),
  dryRun: z.boolean().optional(),
  useSwarm: z.boolean().optional(),
  autoRoute: z.boolean().optional(),
  modelProfile: z.object({
    providerId: z.string().min(1),
    model: z.string().min(1),
    thinking: z.enum(["off", "think", "think-hard", "think-harder", "ultrathink"]).optional(),
    reasoningEffort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
  }).optional(),
});

const EFFORT_PROVIDERS = new Set(["claude-code", "codex", "copilot-cli", "openai", "grok", "nvidia", "openrouter"]);

function supportsEffort(provider: ModelEndpoint) {
  return EFFORT_PROVIDERS.has(provider.id) || EFFORT_PROVIDERS.has(provider.provider);
}

function defaultEffort(provider: ModelEndpoint): ReasoningEffort | undefined {
  if (!supportsEffort(provider)) return undefined;
  if (provider.reasoningEfforts?.includes("medium")) return "medium";
  return provider.reasoningEfforts?.[0] ?? "medium";
}

// Pick a working default when the client (e.g. Command Center quick buttons)
// does not pass a modelProfile. Without this the engine falls back to the
// canned mock summary and the user thinks the model is broken.
function deriveDefaultProfile(): SelectedModelProfile | undefined {
  const providers = listModelProviders();
  const candidates = providers.filter((p) => p.enabled !== false && p.id !== "custom");

  const hasKey = (id: string) => {
    if (id === "anthropic") return Boolean(process.env.ANTHROPIC_API_KEY);
    if (id === "openai") return Boolean(process.env.OPENAI_API_KEY);
    if (id === "openrouter") return Boolean(process.env.OPENROUTER_API_KEY);
    if (id === "nvidia") return Boolean(process.env.NVIDIA_API_KEY);
    if (id === "gemini") return Boolean(process.env.GEMINI_API_KEY);
    if (id === "grok") return Boolean(process.env.GROK_API_KEY ?? process.env.XAI_API_KEY);
    return true; // CLI/local — assume installed; engine catches and falls back
  };

  // Prefer cloud with a configured key, then CLI/local, then anything enabled.
  const cloudWithKey = candidates.find((p) => p.mode === "cloud" && p.requiresApiKey && hasKey(p.id));
  const cliOrLocal = candidates.find((p) => p.mode === "cli" || p.mode === "local");
  const chosen = cloudWithKey ?? cliOrLocal ?? candidates[0];
  if (!chosen) return undefined;
  return {
    providerId: chosen.id,
    model: chosen.model,
    reasoningEffort: defaultEffort(chosen),
  };
}

export async function GET() {
  const runs = await listRuns();
  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  try {
    const body = RunRequestSchema.parse(await request.json());
    if (!body.modelProfile) {
      const derived = deriveDefaultProfile();
      if (derived) body.modelProfile = derived;
    }
    // startRun creates the DB record immediately and processes the model call in background.
    // This prevents HTTP timeouts on long model runs while still returning a navigable run ID.
    const run = await startRun(body);
    return NextResponse.json({ run }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create run" },
      { status: 400 },
    );
  }
}
