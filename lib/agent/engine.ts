import type { AgentPlan, AgentPlanStep, ApprovalRequest, PermissionLevel, Run, RunStep, SelectedModelProfile, Skill, ToolCall } from "@/types";
import { getSkill, classifyPrompt } from "@/lib/skills/registry";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider } from "@/lib/agent/providers";
import { loadProjectModelContext } from "@/lib/agent/project-context";
import { createId, nowIso, titleFromPrompt } from "@/lib/utils";
import { detectRisk, requiresApproval } from "@/lib/permissions/policy";
import { computeCost } from "@/lib/billing/pricing";
import { runSwarm } from "@/lib/agent/swarm";
import {
  addAuditLog,
  insertApproval,
  insertRun,
  insertRunStep,
  insertToolCall,
  listMemoryItems,
  updateRun,
} from "@/lib/db/repositories";
import { indexGeneratedArtifact } from "@/lib/memory/indexer";
import { loadVaultContext, writeVaultMarkdown } from "@/lib/vault/service";
import { pushNotification, isPushConfigured } from "@/lib/notify/push";

export interface RunRequest {
  prompt: string;
  skillId?: string;
  dryRun?: boolean;
  modelProfile?: SelectedModelProfile;
  useSwarm?: boolean;
}

function modeToPermission(mode: Skill["executionMode"]): PermissionLevel {
  if (mode === "auto") return "auto-execute-allowed";
  if (mode === "dry-run") return "draft-only";
  return "approval-required";
}

function buildPlan(runId: string, prompt: string, skill?: Skill, useSwarm = false): AgentPlan {
  const category = skill?.category ?? classifyPrompt(prompt);
  const mode = skill?.executionMode ?? "dry-run";
  const risk = skill?.riskLevel ?? detectRisk(prompt);
  const permission = modeToPermission(mode);

  const baseSteps: AgentPlanStep[] = [
    {
      id: createId("plan_step"),
      title: "Receive and classify goal",
      description: "Normalize prompt, route to the best workflow category, and select a skill if available.",
      expectedTool: "prompt-router",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: createId("plan_step"),
      title: "Load relevant memory",
      description: "Search the local vault index and include only explicit user or generated memory.",
      expectedTool: "memory-index",
      riskLevel: "low",
      requiresApproval: false,
    },
    {
      id: createId("plan_step"),
      title: useSwarm
        ? "Run multi-agent swarm (researcher → writer → critic → editor)"
        : "Execute workflow in adapter layer",
      description: useSwarm
        ? "Spawn parallel sub-agents and merge their outputs into a final artifact."
        : "Run the skill lifecycle with simulated external tool responses when credentials are absent.",
      expectedTool: useSwarm ? "swarm-engine" : skill?.requiredIntegrations[0] ?? "local-workflow",
      riskLevel: risk,
      requiresApproval: requiresApproval(risk, permission),
    },
    {
      id: createId("plan_step"),
      title: "Save artifacts and run memory",
      description: "Persist the summary, logs, and generated output into the vault and memory index.",
      expectedTool: "vault-writer",
      riskLevel: "low",
      requiresApproval: false,
    },
  ];

  return {
    id: createId("plan"),
    runId,
    category,
    summary: `Route prompt through ${skill?.name ?? category} workflow with ${mode} execution.${useSwarm ? " Swarm mode." : ""}`,
    executionMode: mode,
    steps: baseSteps,
    createdAt: nowIso(),
  };
}

function makeStep(runId: string, index: number, title: string): RunStep {
  return {
    id: createId("step"),
    runId,
    index,
    title,
    status: "queued",
  };
}

function makeToolCall(runId: string, stepId: string, tool: string, action: string, input: string, riskLevel: ToolCall["riskLevel"]): ToolCall {
  return {
    id: createId("tool"),
    runId,
    stepId,
    tool,
    action,
    input,
    riskLevel,
    status: "planned",
    createdAt: nowIso(),
  };
}

function fallbackSummary(skill: Skill | undefined, prompt: string, memoryCount: number, modelProfile?: SelectedModelProfile, error?: string) {
  const category = skill?.category ?? classifyPrompt(prompt);
  const skillName = skill?.name ?? "Agentic Workflow";

  const categoryInsights: Record<string, string[]> = {
    content: [
      "Draft is structured for platform-specific distribution. Review tone, hook strength, and CTA placement before publishing.",
      "Quality dimensions to review: clarity, novelty, hook strength, audience fit, CTA clarity, and platform alignment.",
    ],
    research: [
      "Findings are synthesized from available indexed memory. Cross-reference with live sources before citing.",
      "Open questions identified during research should be queued for a follow-up deep-research run.",
    ],
    productivity: [
      "Action items extracted and prioritized by urgency and impact. Review before delegating or scheduling.",
      "Calendar blocks, draft replies, and follow-ups are staged for approval.",
    ],
    memory: [
      "Vault index updated with new artifacts. Run a knowledge-compile skill weekly to maintain coherence.",
    ],
    custom: [
      "CLI / API commands are staged in dry-run mode. Review each command before granting execution approval.",
    ],
    dev: [
      "Repository operations are staged in dry-run mode. Inspect the diff before approving.",
    ],
    business: [
      "Business operations staged. Approval required before any external mutation.",
    ],
  };

  const insights = categoryInsights[category] ?? [
    "Workflow completed in local-first mode. Connect real integrations to unlock full execution.",
  ];

  return [
    `# ${skillName}`,
    "",
    "## Overview",
    `**Task:** ${prompt}`,
    `**Workflow:** ${skillName} · ${category}`,
    `**Memory context:** ${memoryCount} indexed item(s) loaded`,
    `**Model:** ${modelProfile ? `${modelProfile.providerId} / ${modelProfile.model}` : "Local mock (no model selected)"}`,
    error ? `**Model error:** ${error}` : undefined,
    "",
    "## Execution Summary",
    "The workflow ran through all planned steps. Each tool call was logged and risk-assessed.",
    "",
    "## Key Insights",
    ...insights.map((s) => `- ${s}`),
    "",
    "## Next Actions",
    "1. **Review artifacts** — open the vault output at the path shown in Files Created.",
    "2. **Connect integrations** — add API credentials in Settings to enable real execution.",
    "3. **Retry with a model** — select a model profile in the dashboard to generate richer output.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

interface GenerateOutcome {
  output: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

async function generateFinalOutput(
  skill: Skill | undefined,
  prompt: string,
  memoryCount: number,
  modelProfile?: SelectedModelProfile,
  useSwarm = false,
  vaultContext?: string,
  vaultFileCount?: number,
): Promise<GenerateOutcome> {
  const projectContext = await loadProjectModelContext();

  if (!modelProfile) {
    return { output: fallbackSummary(skill, prompt, memoryCount), inputTokens: 0, outputTokens: 0, cost: 0 };
  }

  const provider = getProvider(modelProfile.providerId);

  if (!provider) {
    return {
      output: fallbackSummary(skill, prompt, memoryCount, modelProfile, "Unknown provider; used local mock fallback."),
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
  }

  if (useSwarm) {
    try {
      const result = await runSwarm(prompt, skill, modelProfile, memoryCount, projectContext, vaultContext, vaultFileCount);
      const body = [
        `# ${skill?.name ?? "Swarm Run"}`,
        "",
        `> **Multi-agent swarm** · provider ${provider.id} · model ${modelProfile.model}`,
        "",
        ...result.steps.map((step) => `## ${step.role.toUpperCase()}\n${step.output || `_(error: ${step.error ?? "unknown"})_`}`),
        "",
        "## Final Artifact",
        result.final,
      ].join("\n");
      return {
        output: body,
        inputTokens: result.totalInputTokens,
        outputTokens: result.totalOutputTokens,
        cost: computeCost(modelProfile.model, result.totalInputTokens, result.totalOutputTokens),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Swarm failed";
      return {
        output: fallbackSummary(skill, prompt, memoryCount, modelProfile, `${message}; used local mock fallback.`),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
    }
  }

  try {
    const generated = await generateWithModel({
      provider,
      model: modelProfile.model,
      prompt,
      skill,
      memoryCount,
      projectContext,
      vaultContext,
      vaultFileCount,
      thinking: modelProfile.thinking,
      reasoningEffort: modelProfile.reasoningEffort,
    });

    const body = [
      `# ${skill?.name ?? "Agentic Workflow"}`,
      "",
      `> **Model:** ${provider.id} / ${modelProfile.model}${skill ? ` · **Skill:** ${skill.name} (${skill.category})` : ""}`,
      "",
      generated.content,
    ].join("\n");

    return {
      output: body,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
      cost: computeCost(modelProfile.model, generated.usage.inputTokens, generated.usage.outputTokens),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed";
    return {
      output: fallbackSummary(skill, prompt, memoryCount, modelProfile, `${message}; used local mock fallback.`),
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
    };
  }
}

async function buildAndPersistRun(request: RunRequest): Promise<{ run: Run; plan: AgentPlan }> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");

  const skill = getSkill(request.skillId);
  const runId = createId("run");
  const startedAt = nowIso();
  const useSwarm = request.useSwarm ?? skill?.id === "swarm-cascade";
  const plan = buildPlan(runId, prompt, skill, useSwarm);
  const run: Run = {
    id: runId,
    title: skill?.name ? `${skill.name}: ${titleFromPrompt(prompt)}` : titleFromPrompt(prompt),
    prompt,
    selectedSkill: skill?.id,
    category: plan.category,
    status: "planning",
    startedAt,
    tokensEstimate: 0,
    costEstimate: 0,
    steps: [],
    toolCalls: [],
    approvals: [],
    filesTouched: [],
    errors: [],
    createdArtifacts: [],
  };

  await insertRun(run, plan);
  await addAuditLog({ actor: "agent", action: "created run", integration: "agenticos", riskLevel: "low", result: "completed" });
  return { run, plan };
}

export async function startRun(request: RunRequest): Promise<Run> {
  const { run, plan } = await buildAndPersistRun(request);
  // Fire workflow processing in background — do NOT await so HTTP response returns immediately
  void executeWorkflow(run, plan, request).catch(() => {});
  return run;
}

export async function createAndRunWorkflow(request: RunRequest): Promise<Run> {
  const { run, plan } = await buildAndPersistRun(request);
  await executeWorkflow(run, plan, request);
  return run;
}

async function executeWorkflow(run: Run, plan: AgentPlan, request: RunRequest): Promise<void> {
  try {
    await runWorkflowSteps(run, plan, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workflow failed";
    run.status = "failed";
    run.endedAt = nowIso();
    run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
    run.errors = [message];
    run.finalOutput = `# Error\n\n${message}`;
    await updateRun(run, plan).catch(() => {});
  }
}

async function runWorkflowSteps(run: Run, plan: AgentPlan, request: RunRequest): Promise<void> {
  const prompt = run.prompt;
  const skill = getSkill(request.skillId);
  const useSwarm = request.useSwarm ?? skill?.id === "swarm-cascade";

  const memoryItems = await listMemoryItems(25);
  const isMemorySkill = skill?.category === "memory" || skill?.category === "productivity";
  const vaultSnapshot = await loadVaultContext({
    windowDays: isMemorySkill ? 7 : 14,
    maxFiles: isMemorySkill ? 25 : 10,
    perFileChars: 1800,
    totalChars: isMemorySkill ? 24_000 : 12_000,
  }).catch(() => undefined);
  for (let index = 0; index < plan.steps.length; index += 1) {
    const planStep = plan.steps[index];
    const step = makeStep(run.id, index + 1, planStep.title);
    step.status = "running";
    step.startedAt = nowIso();
    await insertRunStep(step);

    const call = makeToolCall(
      run.id,
      step.id,
      planStep.expectedTool ?? "local-workflow",
      planStep.title,
      JSON.stringify({
        prompt,
        skill: skill?.id,
        dryRun: request.dryRun ?? true,
        modelProfile: request.modelProfile,
        useSwarm,
      }),
      planStep.riskLevel,
    );

    if (planStep.requiresApproval && !request.dryRun) {
      call.status = "blocked";
      call.output = "Blocked pending explicit approval.";
      const approval: ApprovalRequest = {
        id: createId("approval"),
        runId: run.id,
        action: planStep.title,
        integration: planStep.expectedTool ?? "local-workflow",
        affectedResource: skill?.outputLocation ?? "/vault/runs",
        commandOrPayload: call.input,
        riskLevel: planStep.riskLevel,
        explanation: "This action can mutate external systems or local files beyond routine artifact writing.",
        status: "pending",
        createdAt: nowIso(),
      };
      await insertApproval(approval);
      run.approvals.push(approval.id);
      run.status = "waiting_for_approval";
      if (isPushConfigured()) {
        void pushNotification({
          title: `Approval needed: ${approval.action}`,
          message: `Risk: ${approval.riskLevel}. Integration: ${approval.integration}. Resource: ${approval.affectedResource}.`,
          priority: approval.riskLevel === "critical" ? "urgent" : "high",
          tags: ["warning", approval.riskLevel],
          click: `${process.env.AGENTICOS_PUBLIC_URL ?? "http://localhost:3000"}/approvals`,
        });
      }
    } else {
      call.status = "executed";
      call.output = `Mock observation for ${planStep.title}.`;
    }

    await insertToolCall(call);
    run.toolCalls.push(call);
    step.status = "completed";
    step.endedAt = nowIso();
    step.observation = call.output;
    run.steps.push(step);
    await insertRunStep(step);
  }

  const outcome = await generateFinalOutput(
    skill,
    prompt,
    memoryItems.length,
    request.modelProfile,
    useSwarm,
    vaultSnapshot?.rendered,
    vaultSnapshot?.entries.length ?? 0,
  );
  const outputFolder = skill?.outputLocation ?? "/vault/runs";
  const artifact = await writeVaultMarkdown(outputFolder, run.title, outcome.output, {
    frontmatter: {
      tags: [plan.category, skill?.id ?? "unclassified", useSwarm ? "swarm" : "single-agent"].filter(Boolean),
      category: plan.category,
      skill: skill?.id,
      source: "AgenticOS",
      runId: run.id,
      cost: outcome.cost,
      model: request.modelProfile?.model,
    },
    relatedLinks: memoryItems.slice(0, 5).map((m) => m.title),
  });
  await indexGeneratedArtifact(artifact, `Generated result for ${run.title}`, [plan.category, skill?.id ?? "unclassified"].filter(Boolean));

  run.filesTouched.push(artifact);
  run.createdArtifacts.push(artifact);
  run.finalOutput = outcome.output;
  run.tokensEstimate = outcome.inputTokens + outcome.outputTokens;
  run.costEstimate = outcome.cost;
  if (run.status !== "waiting_for_approval") run.status = "completed";
  run.endedAt = nowIso();
  run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
  await updateRun(run, plan);
  await addAuditLog({
    actor: "agent",
    action: `completed workflow${useSwarm ? " (swarm)" : ""} — cost ${outcome.cost.toFixed(4)}`,
    integration: skill?.requiredIntegrations[0] ?? "local",
    riskLevel: skill?.riskLevel ?? "low",
    result: "completed",
  });
}

export async function replayRun(original: Run, prompt?: string) {
  return createAndRunWorkflow({
    prompt: prompt ?? original.prompt,
    skillId: original.selectedSkill,
    dryRun: true,
  });
}
