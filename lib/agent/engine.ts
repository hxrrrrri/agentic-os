import type { AgentPlan, AgentPlanStep, ApprovalRequest, Run, RunStep, Skill, ToolCall } from "@/types";
import { getSkill, classifyPrompt } from "@/lib/skills/registry";
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

function summarize(skill: Skill | undefined, prompt: string, memoryCount: number) {
  const quality = skill?.category === "content" ? "\n\nQuality score: clarity 86, novelty 74, hook strength 82, audience fit 80, CTA strength 76, platform fit 84." : "";
  return [
    `# ${skill?.name ?? "Agentic Workflow"} Result`,
    "",
    `Prompt: ${prompt}`,
    "",
    `Workflow category: ${skill?.category ?? classifyPrompt(prompt)}`,
    `Memory loaded: ${memoryCount} indexed item(s)`,
    "Execution mode: mock/local-first",
    "",
    "## Output",
    "The workflow was planned, observed, logged, and saved locally. External integrations were simulated because no real credentials are configured.",
    "",
    "## Next Actions",
    "- Review generated artifacts in the vault.",
    "- Connect real adapters when ready.",
    "- Keep risky actions approval-gated.",
    quality,
  ]
    .filter(Boolean)
    .join("\n");
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
      JSON.stringify({ prompt, skill: skill?.id, dryRun: request.dryRun ?? true }),
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

  const output = summarize(skill, prompt, memoryItems.length);
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
