import type {
  GeneratedArtifact,
  ModelEndpoint,
  PermissionLevel,
  SelectedModelProfile,
  Skill,
  ToolDefinition,
} from "@/types";
import { generateWithModel } from "@/lib/agent/llm";
import { listAllowedTools } from "@/lib/tools/registry";
import { dispatchTool, type DispatchContext } from "@/lib/tools/dispatcher";
import { buildFallbackArtifactCalls, buildPreflightToolCalls } from "@/lib/agent/artifact-intents";

const MAX_ITERATIONS = 4;
const TOOL_CALL_PATTERN = /```(?:tool[_-]?call|toolcall)\s*\n([\s\S]*?)\n```/gi;
const JSON_TOOL_CALL_PATTERN = /```json\s*\n([\s\S]*?)\n```/gi;

export interface ToolLoopRequest {
  provider: ModelEndpoint;
  modelProfile: SelectedModelProfile;
  prompt: string;
  skill?: Skill;
  permissionLevel: PermissionLevel;
  dryRun: boolean;
  runId: string;
  memoryCount: number;
  projectContext?: string;
  vaultContext?: string;
  vaultFileCount?: number;
  onOutputDelta?: (delta: string) => void;
}

export interface ToolLoopResult {
  finalOutput: string;
  artifacts: GeneratedArtifact[];
  inputTokens: number;
  outputTokens: number;
  iterations: number;
}

interface ParsedCall {
  name: string;
  args: Record<string, unknown>;
  raw: string;
}

function parseToolCalls(text: string): ParsedCall[] {
  const calls: ParsedCall[] = [];
  const pattern = new RegExp(TOOL_CALL_PATTERN.source, "gi");
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const block = match[1].trim();
    // Allow either pure JSON or `name\n{json}` or `name: <name>\n{json}`
    const lines = block.split(/\r?\n/);
    let name = "";
    let jsonStart = 0;
    const firstLine = lines[0].trim();
    if (firstLine.startsWith("{")) {
      // pure JSON; require a "name" key
      try {
        const obj = JSON.parse(block);
        if (obj && typeof obj.name === "string") {
          calls.push({ name: obj.name, args: obj.args ?? obj.arguments ?? {}, raw: match[0] });
        }
      } catch {}
      continue;
    }
    if (/^name\s*[:=]/i.test(firstLine)) {
      name = firstLine.split(/[:=]/)[1].trim();
      jsonStart = 1;
    } else {
      name = firstLine.replace(/[,:]$/, "").trim();
      jsonStart = 1;
    }
    const json = lines.slice(jsonStart).join("\n").trim();
    if (!name || !json) continue;
    try {
      const args = JSON.parse(json) as Record<string, unknown>;
      calls.push({ name, args, raw: match[0] });
    } catch {
      // try to repair simple trailing commas
      try {
        const cleaned = json.replace(/,\s*([}\]])/g, "$1");
        const args = JSON.parse(cleaned) as Record<string, unknown>;
        calls.push({ name, args, raw: match[0] });
      } catch {}
    }
  }

  const jsonPattern = new RegExp(JSON_TOOL_CALL_PATTERN.source, "gi");
  while ((match = jsonPattern.exec(text)) !== null) {
    try {
      const obj = JSON.parse(match[1].trim()) as { name?: unknown; args?: unknown; arguments?: unknown };
      if (obj && typeof obj.name === "string") {
        const args = (obj.args ?? obj.arguments ?? {}) as Record<string, unknown>;
        calls.push({ name: obj.name, args, raw: match[0] });
      }
    } catch {}
  }
  return calls;
}

export function stripToolCalls(text: string): string {
  return text
    .replace(TOOL_CALL_PATTERN, "")
    .replace(JSON_TOOL_CALL_PATTERN, (raw, block: string) => {
      try {
        const obj = JSON.parse(block.trim()) as { name?: unknown };
        return typeof obj.name === "string" ? "" : raw;
      } catch {
        return raw;
      }
    })
    .trim();
}

function renderToolCatalog(tools: ToolDefinition[]): string {
  return tools
    .map((t) => {
      const schema = JSON.stringify(t.inputSchema.properties, null, 2);
      return `### ${t.name} (${t.group}, risk:${t.riskLevel}${t.requiresApproval ? ", approval-gated" : ""})
${t.description}

Args schema:
${schema}`;
    })
    .join("\n\n");
}

function toolSystemAddon(tools: ToolDefinition[]): string {
  return `

## Tool-Use Protocol

You can call any of the tools listed below. To call a tool, emit a fenced block exactly like this — nothing else inside the fence:

\`\`\`toolcall
TOOL_NAME
{"arg1": "value", "arg2": "value"}
\`\`\`

Or as pure JSON:

\`\`\`toolcall
{"name": "TOOL_NAME", "args": {"arg1": "value"}}
\`\`\`

Rules:
- Use tools to generate carousels, thumbnails, images, search Gmail/Drive/Calendar, scrape URLs, or write to the vault.
- Render visual artifacts (carousel/thumbnail/image) BEFORE the final summary so the user sees them in the run detail.
- Read-only tools execute immediately. Approval-gated tools are blocked — describe the intended payload and continue.
- After the system replies with a TOOL_RESULT, continue your response.
- Up to ${MAX_ITERATIONS} tool-iteration rounds per run.

## Available Tools

${renderToolCatalog(tools)}
`;
}

function renderToolResultsBlock(
  results: Array<{ name: string; summary: string; ok: boolean; data?: unknown }>,
): string {
  return results
    .map((r) =>
      `\`\`\`tool_result
${r.name} [${r.ok ? "ok" : "error"}]
${r.summary}
${r.data ? JSON.stringify(r.data).slice(0, 4000) : ""}
\`\`\``,
    )
    .join("\n\n");
}

/** Run a tool-use loop: ask model -> parse tool calls -> dispatch -> feed back
 *  -> repeat until model emits no calls or limit hit. Tool-use model turns are
 *  cleaned before streaming so raw tool-call fences do not become final output. */
export async function runToolLoop(req: ToolLoopRequest): Promise<ToolLoopResult> {
  const allowed = listAllowedTools(req.skill?.tools);
  const systemExtra = toolSystemAddon(allowed);
  const artifacts: GeneratedArtifact[] = [];
  const context: DispatchContext = {
    runId: req.runId,
    skillId: req.skill?.id,
    permissionLevel: req.permissionLevel,
    dryRun: req.dryRun,
    artifactSink: artifacts,
  };

  let conversationPrompt = req.prompt;
  let combinedContent = "";
  let inputTokens = 0;
  let outputTokens = 0;
  let iteration = 0;

  const streamVisible = (text: string) => {
    if (!req.onOutputDelta || !text) return;
    const chunkSize = 512;
    for (let i = 0; i < text.length; i += chunkSize) {
      req.onOutputDelta(text.slice(i, i + chunkSize));
    }
  };

  const appendVisible = (text: string) => {
    const visible = stripToolCalls(text);
    if (!visible) return;
    combinedContent += (combinedContent ? "\n\n" : "") + visible;
    streamVisible(`${visible}\n\n`);
  };

  const preflightObservations: Array<{ name: string; summary: string; ok: boolean; data?: unknown }> = [];
  for (const call of buildPreflightToolCalls(req.prompt, req.skill)) {
    const outcome = await dispatchTool({ name: call.name, args: call.args }, context);
    preflightObservations.push({
      name: call.name,
      summary: outcome.result.summary,
      ok: outcome.result.ok,
      data: outcome.result.data,
    });
  }
  if (preflightObservations.length) {
    conversationPrompt = `${req.prompt}\n\n## Preloaded Tool Results\n${renderToolResultsBlock(preflightObservations)}\n\nUse these real tool results. Do not repeat the same read-only tool call unless the query must change.`;
  }

  for (iteration = 0; iteration < MAX_ITERATIONS; iteration += 1) {
    let generated: Awaited<ReturnType<typeof generateWithModel>>;
    try {
      generated = await generateWithModel({
        provider: req.provider,
        model: req.modelProfile.model,
        prompt: conversationPrompt,
        skill: req.skill,
        memoryCount: req.memoryCount,
        projectContext: req.projectContext,
        vaultContext: req.vaultContext,
        vaultFileCount: req.vaultFileCount,
        systemExtra,
        thinking: req.modelProfile.thinking,
        reasoningEffort: req.modelProfile.reasoningEffort,
      });
    } catch (error) {
      const fallbackCalls = buildFallbackArtifactCalls(req.prompt, req.skill, combinedContent, artifacts);
      if (!fallbackCalls.length && !preflightObservations.length) throw error;

      const observations: Array<{ name: string; summary: string; ok: boolean; data?: unknown }> = [];
      for (const call of fallbackCalls) {
        const outcome = await dispatchTool({ name: call.name, args: call.args }, context);
        observations.push({
          name: call.name,
          summary: outcome.result.summary,
          ok: outcome.result.ok,
          data: outcome.result.data,
        });
      }

      const message = error instanceof Error ? error.message : "model call failed";
      const slideLines = artifacts
        .filter((a) => a.kind === "carousel" && a.format === "svg")
        .map((a, i) => `  ${i + 1}. **${a.title}** — \`${a.path}\``);
      const indexArtifact = artifacts.find((a) => a.kind === "carousel" && a.format === "html");
      const fallbackBlock = [
        "## Tool Execution Fallback",
        "",
        `The model provider failed (${message}), so AgenticOS rendered the artifacts deterministically from the prompt.`,
        "",
        ...[...preflightObservations, ...observations].map((item) => `- ${item.name}: ${item.summary}`),
        slideLines.length ? "" : "",
        slideLines.length ? "### Slides Rendered" : "",
        ...slideLines,
        indexArtifact ? "" : "",
        indexArtifact ? `Preview: \`${indexArtifact.path}\`` : "",
        "",
        "_Open the artifact gallery above to see the rendered slides._",
      ]
        .filter((line) => line !== "" || true)
        .join("\n");
      appendVisible(fallbackBlock);
      break;
    }

    inputTokens += generated.usage.inputTokens;
    outputTokens += generated.usage.outputTokens;
    appendVisible(generated.content);

    const calls = parseToolCalls(generated.content);
    if (!calls.length) break;

    const observations: Array<{ name: string; summary: string; ok: boolean; data?: unknown }> = [];
    for (const call of calls) {
      const outcome = await dispatchTool({ name: call.name, args: call.args }, context);
      observations.push({
        name: call.name,
        summary: outcome.result.summary,
        ok: outcome.result.ok,
        data: outcome.result.data,
      });
    }

    // Build the next user turn with the observations appended.
    conversationPrompt = `${req.prompt}\n\n## Prior Model Output\n${stripToolCalls(generated.content) || "(tool calls only)"}\n\n## Tool Results\n${renderToolResultsBlock(observations)}\n\nContinue. If you have all needed information, write the final answer in markdown.`;
  }

  const fallbackCalls = buildFallbackArtifactCalls(req.prompt, req.skill, combinedContent, artifacts);
  if (fallbackCalls.length) {
    const observations: Array<{ name: string; summary: string; ok: boolean; data?: unknown }> = [];
    for (const call of fallbackCalls) {
      const outcome = await dispatchTool({ name: call.name, args: call.args }, context);
      observations.push({
        name: call.name,
        summary: outcome.result.summary,
        ok: outcome.result.ok,
        data: outcome.result.data,
      });
    }
    const block = [
      "## Generated Visual Artifacts",
      "",
      ...observations.map((item) => `- ${item.name}: ${item.summary}`),
    ].join("\n");
    appendVisible(block);
  }

  return {
    finalOutput: combinedContent,
    artifacts,
    inputTokens,
    outputTokens,
    iterations: iteration + 1,
  };
}

export { parseToolCalls };
