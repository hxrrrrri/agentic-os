import type { AgentPlan, AgentPlanRouting, AgentPlanStep, ApprovalRequest, GeneratedArtifact, PermissionLevel, Run, RunStep, SelectedModelProfile, Skill, ToolCall } from "@/types";
import { getSkill, classifyPrompt } from "@/lib/skills/registry";
import { routeSkill } from "@/lib/skills/router";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider } from "@/lib/agent/providers";
import { loadProjectModelContext } from "@/lib/agent/project-context";
import { createId, nowIso, titleFromPrompt } from "@/lib/utils";
import { detectRisk, requiresApproval } from "@/lib/permissions/policy";
import { computeCost } from "@/lib/billing/pricing";
import { runSwarm } from "@/lib/agent/swarm";
import { runToolLoop } from "@/lib/agent/tool-loop";
import { buildIntentArtifactCalls } from "@/lib/agent/artifact-intents";
import { dispatchTool } from "@/lib/tools/dispatcher";
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
import { emitRunEvent } from "@/lib/agent/event-bus";
import { recordUsage, enforceBudget } from "@/lib/billing/meter";
import { sendWebhookEvent } from "@/lib/notify/webhook";
import { getCached, hashKey, putCached, recordCacheHit } from "@/lib/billing/cache";
import { defaultTierForSkillCategory, routeForSkill } from "@/lib/billing/router";
import { enqueueJob } from "@/lib/jobs/queue";

export interface RunRequest {
  prompt: string;
  skillId?: string;
  dryRun?: boolean;
  modelProfile?: SelectedModelProfile;
  useSwarm?: boolean;
  /** When no skillId is provided, auto-route to the best-fit skill. Defaults to true. */
  autoRoute?: boolean;
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
  providerId?: string;
  model?: string;
  artifacts?: GeneratedArtifact[];
}

async function generateFinalOutput(
  skill: Skill | undefined,
  prompt: string,
  memoryCount: number,
  modelProfile?: SelectedModelProfile,
  useSwarm = false,
  vaultContext?: string,
  vaultFileCount?: number,
  onOutputDelta?: (delta: string) => void,
  toolLoopContext?: { runId: string; permissionLevel: PermissionLevel; dryRun: boolean },
): Promise<GenerateOutcome> {
  const category = skill?.category ?? classifyPrompt(prompt);
  const projectContext = await loadProjectModelContext({ category, prompt });

  if (!modelProfile) {
    const fallback = fallbackSummary(skill, prompt, memoryCount);
    onOutputDelta?.(fallback);
    return { output: fallback, inputTokens: 0, outputTokens: 0, cost: 0 };
  }

  // Cost governor: only reroute skills that explicitly opt into a cost tier.
  const tier = (skill?.costTier as ReturnType<typeof defaultTierForSkillCategory>) ?? defaultTierForSkillCategory(category);
  const routed = routeForSkill(tier, modelProfile);
  if (routed.providerId !== modelProfile.providerId || routed.model !== modelProfile.model) {
    modelProfile = { ...modelProfile, providerId: routed.providerId, model: routed.model };
  }

  // Prompt cache check. Include thinking/effort/skill/vault-context in the
  // key so that two runs with identical user prompt but different settings
  // don't collide. When streaming, replay the cached body through the delta
  // callback so the UI still gets progressive output.
  //
  // Tool-use skills are NOT cached — the cached body would skip dispatch and
  // re-running needs real tool execution every time. We compute the key for
  // non-tool-use skills only and use it both for read + write.
  const cacheExtras = JSON.stringify({
    skill: skill?.id ?? null,
    thinking: modelProfile.thinking ?? null,
    effort: modelProfile.reasoningEffort ?? null,
    useSwarm: useSwarm,
    ctxFiles: vaultFileCount ?? 0,
  });
  const cacheKey = skill?.useTools
    ? null
    : hashKey(modelProfile.providerId, modelProfile.model, prompt, cacheExtras);
  if (cacheKey) {
    const cached = await getCached(cacheKey);
    if (cached) {
      await recordCacheHit(cacheKey).catch(() => {});
      if (onOutputDelta) {
        const chunkSize = 512;
        for (let i = 0; i < cached.response.length; i += chunkSize) {
          onOutputDelta(cached.response.slice(i, i + chunkSize));
        }
      }
      return {
        output: cached.response,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        providerId: modelProfile.providerId,
        model: modelProfile.model,
      };
    }
  }

  const provider = getProvider(modelProfile.providerId);

  if (!provider) {
    const fallback = fallbackSummary(skill, prompt, memoryCount, modelProfile, "Unknown provider; used local mock fallback.");
    onOutputDelta?.(fallback);
    return {
      output: fallback,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      providerId: modelProfile.providerId,
      model: modelProfile.model,
    };
  }

  if (skill?.useTools && toolLoopContext) {
    try {
      const loop = await runToolLoop({
        provider,
        modelProfile,
        prompt,
        skill,
        permissionLevel: toolLoopContext.permissionLevel,
        dryRun: toolLoopContext.dryRun,
        runId: toolLoopContext.runId,
        memoryCount,
        projectContext,
        vaultContext,
        vaultFileCount,
        onOutputDelta,
      });
      const body = [
        `# ${skill?.name ?? "Tool-Use Run"}`,
        "",
        `> **Tool-use** · provider ${provider.id} · model ${modelProfile.model} · iterations ${loop.iterations}`,
        "",
        loop.finalOutput,
      ].join("\n");
      const cost = computeCost(modelProfile.model, loop.inputTokens, loop.outputTokens);
      return {
        output: body,
        inputTokens: loop.inputTokens,
        outputTokens: loop.outputTokens,
        cost,
        providerId: modelProfile.providerId,
        model: modelProfile.model,
        artifacts: loop.artifacts,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool loop failed";
      const fallback = fallbackSummary(skill, prompt, memoryCount, modelProfile, `${message}; tool loop failed.`);
      onOutputDelta?.(fallback);
      return {
        output: fallback,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        providerId: modelProfile.providerId,
        model: modelProfile.model,
      };
    }
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
        providerId: modelProfile.providerId,
        model: modelProfile.model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Swarm failed";
      return {
        output: fallbackSummary(skill, prompt, memoryCount, modelProfile, `${message}; used local mock fallback.`),
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
        providerId: modelProfile.providerId,
        model: modelProfile.model,
      };
    }
  }

  try {
    const outputPrefix = [
      `# ${skill?.name ?? "Agentic Workflow"}`,
      "",
      `> **Model:** ${provider.id} / ${modelProfile.model}${skill ? ` Â· **Skill:** ${skill.name} (${skill.category})` : ""}`,
      "",
    ].join("\n");
    const safeOutputPrefix = [
      `# ${skill?.name ?? "Agentic Workflow"}`,
      "",
      `> **Model:** ${provider.id} / ${modelProfile.model}${skill ? ` - **Skill:** ${skill.name} (${skill.category})` : ""}`,
      "",
    ].join("\n");
    void outputPrefix;
    onOutputDelta?.(safeOutputPrefix);

    // Track whether the provider actually streamed any tokens. Most cloud
    // providers (Anthropic, OpenAI, Gemini, etc.) return the full body in one
    // shot — so without this, the live-output stream stays empty until the
    // run finalises and the page refreshes.
    let providerStreamed = false;
    const wrappedOnToken = onOutputDelta
      ? (token: string) => {
          if (token) providerStreamed = true;
          onOutputDelta(token);
        }
      : undefined;

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
      onToken: wrappedOnToken,
    });

    if (!providerStreamed && onOutputDelta && generated.content) {
      // Chunk the body so the SSE batcher can pace render and the UI shows
      // progress instead of a single huge paint.
      const chunkSize = 256;
      for (let i = 0; i < generated.content.length; i += chunkSize) {
        onOutputDelta(generated.content.slice(i, i + chunkSize));
      }
    }

    const body = [
      `# ${skill?.name ?? "Agentic Workflow"}`,
      "",
      `> **Model:** ${provider.id} / ${modelProfile.model}${skill ? ` · **Skill:** ${skill.name} (${skill.category})` : ""}`,
      "",
      generated.content,
    ].join("\n");

    const finalBody = `${safeOutputPrefix}${generated.content}`;
    void body;

    const cost = computeCost(modelProfile.model, generated.usage.inputTokens, generated.usage.outputTokens);
    // Cache every successful response (streamed or not) — replay path above
    // turns the next streaming hit into a near-instant render. Tool-use skills
    // bypass the cache entirely; cacheKey is null in that case.
    if (cacheKey) {
      void putCached(cacheKey, {
        provider: modelProfile.providerId,
        model: modelProfile.model,
        response: finalBody,
        inputTokens: generated.usage.inputTokens,
        outputTokens: generated.usage.outputTokens,
        costUsd: cost,
      }).catch(() => {});
    }

    return {
      output: finalBody,
      inputTokens: generated.usage.inputTokens,
      outputTokens: generated.usage.outputTokens,
      cost,
      providerId: modelProfile.providerId,
      model: modelProfile.model,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Model call failed";
    const fallback = fallbackSummary(skill, prompt, memoryCount, modelProfile, `${message}; used local mock fallback.`);
    onOutputDelta?.(fallback);
    return {
      output: fallback,
      inputTokens: 0,
      outputTokens: 0,
      cost: 0,
      providerId: modelProfile.providerId,
      model: modelProfile.model,
    };
  }
}

async function buildAndPersistRun(request: RunRequest): Promise<{ run: Run; plan: AgentPlan }> {
  const prompt = request.prompt.trim();
  if (!prompt) throw new Error("Prompt is required");

  let skill = getSkill(request.skillId);
  let routing: AgentPlanRouting | undefined;
  const wantAutoRoute = request.autoRoute !== false;
  if (!skill && wantAutoRoute) {
    const decision = await routeSkill(prompt, { modelProfile: request.modelProfile }).catch(() => undefined);
    if (decision) {
      routing = {
        skillId: decision.skill?.id,
        confidence: decision.confidence,
        reason: decision.reason,
        tokensUsed: decision.tokensUsed,
        candidates: decision.candidates,
      };
      if (decision.skill) {
        skill = decision.skill;
        request.skillId = decision.skill.id;
      }
    }
  }
  const runId = createId("run");
  const startedAt = nowIso();
  const useSwarm = request.useSwarm ?? skill?.id === "swarm-cascade";
  const plan = buildPlan(runId, prompt, skill, useSwarm);
  if (routing) plan.routing = routing;
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
  emitRunEvent({ runId: run.id, type: "run.started", payload: { title: run.title, category: run.category, plan } });
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
    const detail = error instanceof Error && error.stack ? error.stack : String(error);
    run.status = "failed";
    run.endedAt = nowIso();
    run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
    run.errors = [message];
    run.errorDetail = detail.slice(0, 8000);
    run.finalOutput = `# Error\n\n${message}`;
    await updateRun(run, plan).catch(() => {});
    emitRunEvent({ runId: run.id, type: "run.failed", payload: { error: message } });
    void sendWebhookEvent({
      title: `Run failed: ${run.title}`,
      message,
      level: "error",
      runId: run.id,
    });
  }
}

async function runWorkflowSteps(run: Run, plan: AgentPlan, request: RunRequest): Promise<void> {
  const prompt = run.prompt;
  const skill = getSkill(request.skillId);
  const useSwarm = request.useSwarm ?? skill?.id === "swarm-cascade";

  const budgetCheck = await enforceBudget();
  if (!budgetCheck.allowed) {
    run.status = "failed";
    run.errors = [`Budget exceeded: ${budgetCheck.reason}`];
    run.finalOutput = `# Budget exceeded\n\n${budgetCheck.reason}`;
    run.endedAt = nowIso();
    run.durationMs = 0;
    await updateRun(run, plan);
    emitRunEvent({ runId: run.id, type: "run.failed", payload: { reason: budgetCheck.reason } });
    return;
  }

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

    emitRunEvent({
      runId: run.id,
      type: "run.step",
      payload: { stepIndex: index + 1, title: step.title, status: step.status },
    });

    if (planStep.requiresApproval && !request.dryRun) {
      call.status = "blocked";
      call.output = "Blocked pending explicit approval.";
      // 24h default expiry for any approval — recovery sweep flips stale rows
      // to `expired` so the inbox doesn't grow unbounded.
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
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
        expiresAt,
      };
      await insertApproval(approval);
      run.approvals.push(approval.id);
      run.status = "waiting_for_approval";
      emitRunEvent({
        runId: run.id,
        type: "run.approval",
        payload: { approvalId: approval.id, action: approval.action, risk: approval.riskLevel },
      });
      if (isPushConfigured()) {
        void pushNotification({
          title: `Approval needed: ${approval.action}`,
          message: `Risk: ${approval.riskLevel}. Integration: ${approval.integration}. Resource: ${approval.affectedResource}.`,
          priority: approval.riskLevel === "critical" ? "urgent" : "high",
          tags: ["warning", approval.riskLevel],
          click: `${process.env.AGENTICOS_PUBLIC_URL ?? "http://localhost:3000"}/approvals`,
        });
      }
      void sendWebhookEvent({
        title: `Approval needed: ${approval.action}`,
        message: `Risk ${approval.riskLevel} · ${approval.integration} · ${approval.affectedResource}`,
        level: "warn",
        runId: run.id,
      });
    } else {
      call.status = "executed";
      call.output = `Mock observation for ${planStep.title}.`;
    }

    await insertToolCall(call);
    run.toolCalls.push(call);
    emitRunEvent({
      runId: run.id,
      type: "run.tool",
      payload: { tool: call.tool, action: call.action, status: call.status, risk: call.riskLevel },
    });
    step.status = "completed";
    step.endedAt = nowIso();
    step.observation = call.output;
    run.steps.push(step);
    await insertRunStep(step);
    emitRunEvent({
      runId: run.id,
      type: "run.step",
      payload: { stepIndex: index + 1, title: step.title, status: step.status },
    });
  }

  let queuedOutput = "";
  let outputFlushTimer: ReturnType<typeof setTimeout> | null = null;
  const flushOutput = () => {
    if (outputFlushTimer) {
      clearTimeout(outputFlushTimer);
      outputFlushTimer = null;
    }
    if (!queuedOutput) return;
    emitRunEvent({ runId: run.id, type: "run.output", payload: { delta: queuedOutput } });
    queuedOutput = "";
  };
  const queueOutputDelta = (delta: string) => {
    if (!delta) return;
    queuedOutput += delta;
    if (queuedOutput.length >= 512) {
      flushOutput();
      return;
    }
    if (!outputFlushTimer) outputFlushTimer = setTimeout(flushOutput, 120);
  };

  const outcome = await generateFinalOutput(
    skill,
    prompt,
    memoryItems.length,
    request.modelProfile,
    useSwarm,
    vaultSnapshot?.rendered,
    vaultSnapshot?.entries.length ?? 0,
    queueOutputDelta,
    {
      runId: run.id,
      permissionLevel: modeToPermission(skill?.executionMode ?? "dry-run"),
      dryRun: request.dryRun ?? true,
    },
  );
  flushOutput();

  // If the user clearly asked for a carousel/thumbnail/image but the tool-loop
  // did not fire (no skill / non-useTools skill), render the artifact now using
  // the generated text as slide source. Keeps prompt → artifact contract even
  // when auto-routing misses or the user picks the wrong skill.
  const intentArtifacts: GeneratedArtifact[] = outcome.artifacts ? [...outcome.artifacts] : [];
  const intentCalls = buildIntentArtifactCalls(prompt, outcome.output, intentArtifacts);
  if (intentCalls.length) {
    const context = {
      runId: run.id,
      skillId: skill?.id,
      permissionLevel: modeToPermission(skill?.executionMode ?? "dry-run"),
      dryRun: request.dryRun ?? true,
      artifactSink: intentArtifacts,
    };
    for (const call of intentCalls) {
      try {
        await dispatchTool({ name: call.name, args: call.args }, context);
      } catch (error) {
        const message = error instanceof Error ? error.message : "intent render failed";
        emitRunEvent({ runId: run.id, type: "run.log", payload: { level: "warn", message: `${call.name} skipped: ${message}` } });
      }
    }
    outcome.artifacts = intentArtifacts;
  }
  const outputFolder = skill?.outputLocation ?? "/vault/runs";
  const artifact = await writeVaultMarkdown(outputFolder, run.title, outcome.output, {
    frontmatter: {
      tags: [plan.category, skill?.id ?? "unclassified", useSwarm ? "swarm" : "single-agent"].filter(Boolean),
      category: plan.category,
      skill: skill?.id,
      source: "AgenticOS",
      runId: run.id,
      cost: outcome.cost,
      provider: outcome.providerId ?? request.modelProfile?.providerId,
      model: outcome.model ?? request.modelProfile?.model,
    },
    relatedLinks: memoryItems.slice(0, 5).map((m) => m.title),
  });
  await indexGeneratedArtifact(artifact, `Generated result for ${run.title}`, [plan.category, skill?.id ?? "unclassified"].filter(Boolean)).catch((error) => {
    const message = error instanceof Error ? error.message : "memory indexing failed";
    emitRunEvent({ runId: run.id, type: "run.log", payload: { level: "warn", message: `Memory indexing skipped: ${message}` } });
  });

  run.filesTouched.push(artifact);
  run.createdArtifacts.push(artifact);
  if (outcome.artifacts?.length) {
    run.artifacts = [...(run.artifacts ?? []), ...outcome.artifacts];
    for (const generated of outcome.artifacts) {
      if (!run.createdArtifacts.includes(generated.path)) run.createdArtifacts.push(generated.path);
    }
  }
  run.finalOutput = outcome.output;
  run.tokensEstimate = outcome.inputTokens + outcome.outputTokens;
  run.costEstimate = outcome.cost;
  if (run.status !== "waiting_for_approval") run.status = "completed";
  run.endedAt = nowIso();
  run.durationMs = +new Date(run.endedAt) - +new Date(run.startedAt);
  try {
    await updateRun(run, plan);
  } catch (error) {
    // DB write failed — best-effort retry with status=failed so the SSE stream
    // can close out instead of polling forever.
    run.status = "failed";
    run.errors = [...run.errors, error instanceof Error ? error.message : "updateRun failed"];
    await updateRun(run, plan).catch(() => {});
  }
  await recordUsage({
    runId: run.id,
    skillId: skill?.id,
    provider: outcome.providerId ?? request.modelProfile?.providerId,
    model: outcome.model ?? request.modelProfile?.model,
    inputTokens: outcome.inputTokens,
    outputTokens: outcome.outputTokens,
    costUsd: outcome.cost,
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "usage metering failed";
    emitRunEvent({ runId: run.id, type: "run.log", payload: { level: "warn", message: `Usage metering skipped: ${message}` } });
  });
  // F10: queue auto-grading for completed runs that produced model output.
  if (run.status === "completed" && outcome.outputTokens > 0) {
    void enqueueJob("run.grade", { runId: run.id, skillId: skill?.id }, { runAfter: new Date(Date.now() + 5_000) }).catch(() => {});
  }
  emitRunEvent({
    runId: run.id,
    type: "run.artifact",
    payload: { path: artifact, cost: outcome.cost },
  });
  emitRunEvent({
    runId: run.id,
    type: run.status === "completed" ? "run.completed" : "run.status",
    payload: { status: run.status, cost: outcome.cost, tokens: run.tokensEstimate },
  });
  void sendWebhookEvent({
    title: `Run ${run.status}: ${run.title}`,
    message: `Tokens ${run.tokensEstimate}, cost $${outcome.cost.toFixed(4)}, artifact ${artifact}`,
    level: run.status === "completed" ? "info" : "warn",
    runId: run.id,
  });
  await addAuditLog({
    actor: "agent",
    action: `completed workflow${useSwarm ? " (swarm)" : ""} — cost ${outcome.cost.toFixed(4)}`,
    integration: skill?.requiredIntegrations[0] ?? "local",
    riskLevel: skill?.riskLevel ?? "low",
    result: "completed",
  }).catch((error) => {
    const message = error instanceof Error ? error.message : "audit log failed";
    emitRunEvent({ runId: run.id, type: "run.log", payload: { level: "warn", message: `Audit log skipped: ${message}` } });
  });
}

export async function replayRun(original: Run, prompt?: string) {
  return createAndRunWorkflow({
    prompt: prompt ?? original.prompt,
    skillId: original.selectedSkill,
    dryRun: true,
  });
}
