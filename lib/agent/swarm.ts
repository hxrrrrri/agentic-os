import type { SelectedModelProfile, Skill } from "@/types";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider } from "@/lib/agent/providers";

export type SwarmRole = "researcher" | "writer" | "critic" | "editor";

export interface SwarmStep {
  role: SwarmRole;
  prompt: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  error?: string;
}

export interface SwarmResult {
  steps: SwarmStep[];
  final: string;
  totalInputTokens: number;
  totalOutputTokens: number;
}

const rolePrompts: Record<SwarmRole, string> = {
  researcher: "You are the Researcher sub-agent. Gather every relevant fact, source, angle, and counter-argument. Output a structured research brief with citations.",
  writer: "You are the Writer sub-agent. Use the research brief to produce a polished draft optimised for the target format. Match the requested tone exactly.",
  critic: "You are the Critic sub-agent. Score the draft on: clarity, novelty, hook strength, audience fit, CTA clarity, factual accuracy. Flag every weakness with a concrete fix.",
  editor: "You are the Editor sub-agent. Apply the critic's fixes and ship the final version. Preserve voice. Tighten prose. Output ONLY the final artifact — no commentary.",
};

export async function runSwarm(
  goal: string,
  skill: Skill | undefined,
  modelProfile: SelectedModelProfile,
  memoryCount: number,
  projectContext?: string,
  vaultContext?: string,
  vaultFileCount?: number,
): Promise<SwarmResult> {
  const provider = getProvider(modelProfile.providerId);
  if (!provider) throw new Error(`Unknown provider ${modelProfile.providerId}`);

  const steps: SwarmStep[] = [];
  let context = `## Original goal\n${goal}`;
  let totalIn = 0;
  let totalOut = 0;

  const sequence: SwarmRole[] = ["researcher", "writer", "critic", "editor"];

  for (const role of sequence) {
    const rolePrompt = `${context}\n\n## Sub-agent role\n${rolePrompts[role]}`;
    try {
      const result = await generateWithModel({
        provider,
        model: modelProfile.model,
        prompt: rolePrompt,
        skill,
        memoryCount,
        projectContext,
        vaultContext,
        vaultFileCount,
        systemExtra: `You are operating as the ${role.toUpperCase()} sub-agent inside a multi-agent swarm.`,
        thinking: modelProfile.thinking,
        reasoningEffort: modelProfile.reasoningEffort,
      });
      steps.push({
        role,
        prompt: rolePrompt,
        output: result.content,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
      });
      totalIn += result.usage.inputTokens;
      totalOut += result.usage.outputTokens;
      context = `${context}\n\n## ${role} output\n${result.content}`;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sub-agent failed";
      steps.push({ role, prompt: rolePrompt, output: "", inputTokens: 0, outputTokens: 0, error: message });
      break;
    }
  }

  const final = steps[steps.length - 1]?.output ?? "Swarm produced no output.";
  return { steps, final, totalInputTokens: totalIn, totalOutputTokens: totalOut };
}
