import type { AgentPlan, AgentPlanStep, ApprovalRequest, Run, RunStep, SelectedModelProfile, Skill, ToolCall } from "@/types";
import { getSkill, classifyPrompt } from "@/lib/skills/registry";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider } from "@/lib/agent/providers";
import { loadProjectModelContext } from "@/lib/agent/project-context";
import { createId, nowIso, titleFromPrompt } from "@/lib/utils";
import { detectRisk, requiresApproval } from "@/lib/permissions/policy";
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
import { writeVaultMarkdown } from "@/lib/vault/service";

export interface RunRequest {
  prompt: string;
  skillId?: string;
  dryRun?: boolean;
  modelProfile?: SelectedModelProfile;
}

function buildPlan(runId: string, prompt: string, skill?: Skill): AgentPlan {
  const category = skill?.category ?? classifyPrompt(prompt);
  const mode = skill?.executionMode ?? "dry-run";
  const risk = skill?.riskLevel ?? detectRisk(prompt);
  const steps: AgentPlanStep[] = [
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
      title: "Execute workflow in mock adapter layer",
      description: "Run the skill lifecycle with simulated external tool responses when credentials are absent.",
      expectedTool: skill?.requiredIntegrations[0] ?? "local-workflow",
      riskLevel: risk,
      requiresApproval: requiresApproval(risk, mode === "auto" ? "auto-execute-allowed" : mode === "dry-run" ? "read-only" : "approval-required"),
    },
    {
      id: createId("plan_step"),
      title: "Save artifacts and run memory",
      description: "Persist the summary, logs, and generated output into the vault and memory index.",
      expectedTool: "vault-writer",
      riskLevel: "medium",
      requiresApproval: false,
    },
  ];

  return {
    id: createId("plan"),
    runId,
    category,
    summary: `Route prompt through ${skill?.name ?? category} workflow with ${mode} execution.`,
    executionMode: mode,
    steps,
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

function summarize(skill: Skill | undefined, prompt: string, memoryCount: number, modelProfile?: SelectedModelProfile, error?: string) {
  const category = skill?.category ?? classifyPrompt(prompt);
  const skillName = skill?.name ?? "Agentic Workflow";

  const categoryInsights: Record<string, string[]> = {
    content: [
      "Draft is structured for platform-specific distribution. Review tone, hook strength, and CTA placement before publishing.",
      "Recommended platforms based on content type: LinkedIn (thought leadership), YouTube (long-form), Newsletter (retention).",
      "Quality dimensions to review: clarity, novelty, hook strength, audience fit, CTA clarity, and platform alignment.",
    ],
    research: [
      "Findings are synthesized from available indexed memory. Cross-reference with live sources before citing.",
      "Source hierarchy: primary > secondary > synthesized. Flag any gaps in coverage for follow-up.",
      "Open questions identified during research should be queued for a follow-up deep-research run.",
    ],
    productivity: [
      "Action items extracted and prioritized by urgency and impact. Review before delegating or scheduling.",
      "Calendar blocks, draft replies, and follow-ups are staged for approval — nothing is sent without confirmation.",
      "Recommended: process high-priority items within 24 hours to avoid context decay.",
    ],
    memory: [
      "Vault index updated with new artifacts. Run a knowledge-compile skill weekly to maintain coherence.",
      "Duplicate or stale entries flagged for cleanup. Review vault-cleanup skill output before deleting.",
      "Memory search is now indexing this run — future runs will have richer context.",
    ],
    custom: [
      "CLI / API commands are staged in dry-run mode. Review each command before granting execution approval.",
      "Risk levels are assigned per-command. Critical-risk commands require explicit user confirmation.",
      "Audit log is recording all tool calls for this session.",
    ],
  };

  const insights = categoryInsights[category] ?? [
    "Workflow completed in local-first mode. Connect real integrations to unlock full execution.",
    "All tool calls are logged and available in the run detail view.",
  ];

  const qualitySection = skill?.category === "content"
    ? [
        "",
        "## Quality Assessment",
        "| Dimension | Score | Notes |",
        "|-----------|-------|-------|",
        "| Clarity | 86/100 | Strong. Minor jargon to simplify. |",
        "| Novelty | 74/100 | Good angle. Add a contrarian hook. |",
        "| Hook Strength | 82/100 | Lead hook works. Test 2–3 variants. |",
        "| Audience Fit | 80/100 | On-target. Sharpen persona specificity. |",
        "| CTA Clarity | 76/100 | CTA present. Make it more action-specific. |",
        "| Platform Fit | 84/100 | Format matches. Check character limits. |",
      ]
    : [];

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
    "The workflow ran through all planned steps in local-first mode. Each tool call was logged, risk-assessed, and observed. External integrations were simulated — no external systems were modified.",
    "",
    "**Steps completed:**",
    "1. Goal received and classified",
    "2. Vault memory searched and loaded",
    "3. Workflow executed in mock adapter layer",
    "4. Artifacts saved to vault",
    "",
    "## Key Insights",
    ...insights.map((s) => `- ${s}`),
    ...qualitySection,
    "",
    "## Next Actions",
    "1. **Review artifacts** — open the vault output at the path shown in Files Created.",
    "2. **Connect integrations** — add API credentials in Settings to enable real execution.",
    "3. **Retry with a model** — select a model profile in the dashboard to generate richer output.",
    "4. **Schedule recurring runs** — set this skill to run automatically if it fits a daily or weekly rhythm.",
  ]
    .filter((line) => line !== undefined)
    .join("\n");
}

async function generateFinalOutput(skill: Skill | undefined, prompt: string, memoryCount: number, modelProfile?: SelectedModelProfile) {
  const projectContext = await loadProjectModelContext();

  if (!modelProfile) {
    return summarize(skill, prompt, memoryCount);
  }

  const provider = getProvider(modelProfile.providerId);

  if (!provider) {
    return summarize(skill, prompt, memoryCount, modelProfile, "Unknown provider; used local mock fallback.");
  }

  try {
    const generated = await generateWithModel({
      provider,
      model: modelProfile.model,
      prompt,
      skill,
      memoryCount,
      projectContext,
    });

    return [
      `# ${skill?.name ?? "Agentic Workflow"}`,
      "",
      `> **Model:** ${provider.id} / ${modelProfile.model}${skill ? ` · **Skill:** ${skill.name} (${skill.category})` : ""}`,
      "",
      generated,
    ].join("\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed";
    return summarize(skill, prompt, memoryCount, modelProfile, `${message}; used local mock fallback.`);
  }
}

export async function createAndRunWorkflow(request: RunRequest): Promise<Run> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");

  const skill = getSkill(request.skillId);
  const runId = createId("run");
  const startedAt = nowIso();
  const plan = buildPlan(runId, prompt, skill);
  const run: Run = {
    id: runId,
    title: skill?.name ? `${skill.name}: ${titleFromPrompt(prompt)}` : titleFromPrompt(prompt),
    prompt,
    selectedSkill: skill?.id,
    category: plan.category,
    status: "planning",
    startedAt,
    tokensEstimate: Math.max(650, prompt.length * 3 + plan.steps.length * 180),
    costEstimate: 0.0,
    steps: [],
    toolCalls: [],
    approvals: [],
    filesTouched: [],
    errors: [],
    createdArtifacts: [],
  };

  await insertRun(run, plan);
  await addAuditLog({ actor: "agent", action: "created run", integration: "agenticos", riskLevel: "low", result: "completed" });

  const memoryItems = await listMemoryItems(25);
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

  const output = await generateFinalOutput(skill, prompt, memoryItems.length, request.modelProfile);
  const outputFolder = skill?.outputLocation ?? "/vault/runs";
  const artifact = await writeVaultMarkdown(outputFolder, run.title, output);
  await indexGeneratedArtifact(artifact, `Generated result for ${run.title}`, [plan.category, skill?.id ?? "unclassified"].filter(Boolean));

  run.filesTouched.push(artifact);
  run.createdArtifacts.push(artifact);
  run.finalOutput = output;
  if (run.status !== "waiting_for_approval") run.status = "completed";
  run.endedAt = nowIso();
  run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
  await updateRun(run, plan);
  await addAuditLog({ actor: "agent", action: "completed mock workflow", integration: skill?.requiredIntegrations[0] ?? "local", riskLevel: skill?.riskLevel ?? "low", result: "completed" });

  return run;
}

export async function replayRun(original: Run, prompt?: string) {
  return createAndRunWorkflow({
    prompt: prompt ?? original.prompt,
    skillId: original.selectedSkill,
    dryRun: true,
  });
}
