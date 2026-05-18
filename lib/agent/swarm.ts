import type { SelectedModelProfile, Skill } from "@/types";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider } from "@/lib/agent/providers";
import { computeCost } from "@/lib/billing/pricing";

export type SwarmRole = "planner" | "researcher" | "writer" | "critic" | "editor";

export interface SwarmStep {
  role: SwarmRole;
  prompt: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  iteration?: number;
  error?: string;
}

export interface SwarmResult {
  steps: SwarmStep[];
  final: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: number;
  halted?: string;
}

export interface SwarmOptions {
  // Hard cap on total LLM cost across the swarm (USD). Engine short-circuits
  // when exceeded.
  budgetUsd?: number;
  // How many critic→editor revision loops to allow before settling.
  maxRevisions?: number;
}

const rolePrompts: Record<SwarmRole, string> = {
  planner:
    "You are the Planner sub-agent. Read the goal and produce a 3-7 bullet plan covering: target output, must-include points, audience, evidence required, success criteria. Output only the plan.",
  researcher:
    "You are the Researcher sub-agent. Follow the plan. Gather every relevant fact, source, angle, and counter-argument. Output a structured research brief with citations (inline links if you have them).",
  writer:
    "You are the Writer sub-agent. Use the research brief to produce a polished draft optimised for the target format. Match the requested tone exactly. Be concrete, no filler.",
  critic:
    "You are the Critic sub-agent. Score the draft on: clarity, novelty, hook strength, audience fit, CTA clarity, factual accuracy. For each weakness, write a one-line concrete fix. If the draft is ready, say PASS on its own line. Otherwise list fixes only.",
  editor:
    "You are the Editor sub-agent. Apply the critic's fixes and ship the final version. Preserve voice. Tighten prose. Output ONLY the final artifact — no commentary.",
};

export async function runSwarm(
  goal: string,
  skill: Skill | undefined,
  modelProfile: SelectedModelProfile,
  memoryCount: number,
  projectContext?: string,
  vaultContext?: string,
  vaultFileCount?: number,
  options: SwarmOptions = {},
): Promise<SwarmResult> {
  const provider = getProvider(modelProfile.providerId);
  if (!provider) throw new Error(`Unknown provider ${modelProfile.providerId}`);

  const budget = options.budgetUsd ?? 2.0;
  const maxRevisions = options.maxRevisions ?? 1;

  const steps: SwarmStep[] = [];
  let totalIn = 0;
  let totalOut = 0;
  let totalCost = 0;
  let halted: string | undefined;

  const log = async (role: SwarmRole, rolePrompt: string, contextBlock: string, iteration?: number): Promise<string> => {
    if (totalCost >= budget) {
      halted = `Budget cap $${budget.toFixed(2)} hit before ${role}`;
      throw new Error(halted);
    }
    try {
      const result = await generateWithModel({
        provider,
        model: modelProfile.model,
        prompt: contextBlock,
        skill,
        memoryCount,
        projectContext,
        vaultContext,
        vaultFileCount,
        systemExtra: `You are the ${role.toUpperCase()} sub-agent inside a multi-agent swarm. ${rolePrompts[role]}`,
        thinking: modelProfile.thinking,
        reasoningEffort: modelProfile.reasoningEffort,
      });
      const cost = computeCost(modelProfile.model, result.usage.inputTokens, result.usage.outputTokens);
      steps.push({
        role,
        prompt: rolePrompt,
        output: result.content,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costUsd: cost,
        iteration,
      });
      totalIn += result.usage.inputTokens;
      totalOut += result.usage.outputTokens;
      totalCost += cost;
      return result.content;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Sub-agent failed";
      steps.push({ role, prompt: rolePrompt, output: "", inputTokens: 0, outputTokens: 0, costUsd: 0, error: message, iteration });
      throw error;
    }
  };

  try {
    let context = `## Original goal\n${goal}`;

    const plan = await log("planner", context, `${context}\n\n## Your task\n${rolePrompts.planner}`);
    context += `\n\n## Plan\n${plan}`;

    const brief = await log("researcher", context, `${context}\n\n## Your task\n${rolePrompts.researcher}`);
    context += `\n\n## Research brief\n${brief}`;

    let draft = await log("writer", context, `${context}\n\n## Your task\n${rolePrompts.writer}`);
    context += `\n\n## Draft\n${draft}`;

    for (let iteration = 1; iteration <= maxRevisions + 1; iteration++) {
      const critique = await log(
        "critic",
        context,
        `${context}\n\n## Your task\n${rolePrompts.critic}`,
        iteration,
      );
      if (/(^|\n)PASS\b/i.test(critique) || iteration > maxRevisions) {
        // Final editor pass
        const final = await log(
          "editor",
          context,
          `${context}\n\n## Critic notes\n${critique}\n\n## Your task\n${rolePrompts.editor}`,
          iteration,
        );
        draft = final;
        break;
      }
      // Edit then re-critic
      draft = await log(
        "editor",
        context,
        `${context}\n\n## Critic notes\n${critique}\n\n## Your task\n${rolePrompts.editor}`,
        iteration,
      );
      context = context.replace(/## Draft\n[\s\S]*$/, `## Draft (rev ${iteration})\n${draft}`);
    }

    return {
      steps,
      final: draft,
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      totalCost,
      halted,
    };
  } catch {
    return {
      steps,
      final: steps[steps.length - 1]?.output ?? "Swarm produced no output.",
      totalInputTokens: totalIn,
      totalOutputTokens: totalOut,
      totalCost,
      halted: halted ?? "Sub-agent error halted the swarm.",
    };
  }
}
