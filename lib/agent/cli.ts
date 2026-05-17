import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { GenerateWithModelRequest, GenerateWithModelResult } from "@/lib/agent/llm";
import { THINKING_KEYWORDS } from "@/lib/agent/llm";

const DEFAULT_TIMEOUT_MS = 180_000;

function resolveCommand(envVar: string, fallback: string): string {
  return process.env[envVar]?.trim() || fallback;
}

interface RunCliOptions {
  command: string;
  args: string[];
  stdin?: string;
  timeoutMs?: number;
  cwd?: string;
}

interface RunCliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

function runCli(options: RunCliOptions): Promise<RunCliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(options.command, options.args, {
      cwd: options.cwd ?? process.cwd(),
      shell: process.platform === "win32",
      env: process.env,
    });

    let stdout = "";
    let stderr = "";
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        child.kill("SIGKILL");
      } catch {}
      reject(new Error(`CLI timeout after ${options.timeoutMs ?? DEFAULT_TIMEOUT_MS}ms: ${options.command}`));
    }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

    child.stdout?.on("data", (chunk: Buffer) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr?.on("data", (chunk: Buffer) => {
      stderr += chunk.toString("utf8");
    });

    child.on("error", (error: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        reject(new Error(`CLI not found: ${options.command}. Install it and ensure it is on PATH.`));
      } else {
        reject(error);
      }
    });

    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ stdout, stderr, exitCode: code ?? 0 });
    });

    if (options.stdin) {
      child.stdin?.write(options.stdin);
    }
    child.stdin?.end();
  });
}

function approxTokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

function buildPromptText(request: GenerateWithModelRequest): { system: string; user: string } {
  const system = [
    "You are AgenticOS, an expert AI workflow operator.",
    "Output Obsidian-compatible markdown — use [[wiki-links]] and #tags where helpful.",
    "Be direct, expert, precise. No filler.",
    "Lead with the most important insight or action.",
    "Close with a prioritized action section.",
    request.skill ? `\n## Active Skill: ${request.skill.name}\nCategory: ${request.skill.category} | Output: ${request.skill.outputLocation}` : "",
    request.projectContext ? `\n${request.projectContext}` : "",
    request.systemExtra ? `\n${request.systemExtra}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const userParts: string[] = [
    "## Task",
    request.prompt,
    "",
    "## Context",
    `- Local memory items indexed: ${request.memoryCount}`,
    `- Vault notes provided inline below: ${request.vaultFileCount ?? 0}`,
    "- Execution environment: local-first",
    "- IMPORTANT: do NOT attempt to read files from disk. The vault is NOT mounted in your sandbox. Use ONLY the vault notes provided inline below. If a needed note is not present, state that explicitly.",
  ];
  if (request.vaultContext && request.vaultContext.trim()) {
    userParts.push(
      "",
      "## Vault Notes (recent activity, provided inline)",
      request.vaultContext,
    );
  }
  userParts.push(
    "",
    "## Instructions",
    "Produce a complete, well-structured response. Use markdown headings and lists.",
  );
  const user = userParts.join("\n");

  return { system, user };
}

export async function generateWithClaudeCli(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const command = resolveCommand("CLAUDE_CLI_PATH", "claude");
  const { system, user } = buildPromptText(request);
  const thinkingLevel = request.thinking ?? "off";
  const thinkingKeyword = THINKING_KEYWORDS[thinkingLevel];
  const prefix = thinkingKeyword ? `${thinkingKeyword}\n\n` : "";
  const fullPrompt = `${prefix}${system}\n\n---\n\n${user}`;

  const args = ["-p", "--output-format", "json"];
  if (request.model && request.model !== "Claude Code CLI") {
    args.push("--model", request.model);
  }

  const result = await runCli({
    command,
    args,
    stdin: fullPrompt,
    timeoutMs: DEFAULT_TIMEOUT_MS,
  });

  if (result.exitCode !== 0 && !result.stdout.trim()) {
    throw new Error(`Claude CLI exited ${result.exitCode}: ${result.stderr.slice(0, 400) || "no output"}`);
  }

  const trimmed = result.stdout.trim();

  try {
    const parsed = JSON.parse(trimmed) as {
      result?: string;
      content?: string;
      message?: { content?: string };
      usage?: { input_tokens?: number; output_tokens?: number };
      is_error?: boolean;
      error?: string;
    };

    if (parsed.is_error) {
      throw new Error(`Claude CLI error: ${parsed.error ?? "unknown"}`);
    }

    const content = (parsed.result ?? parsed.content ?? parsed.message?.content ?? "").trim();
    if (!content) {
      throw new Error("Claude CLI returned empty result");
    }

    return {
      content,
      usage: {
        inputTokens: parsed.usage?.input_tokens ?? approxTokens(fullPrompt),
        outputTokens: parsed.usage?.output_tokens ?? approxTokens(content),
      },
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      if (!trimmed) throw new Error("Claude CLI returned empty stdout");
      return {
        content: trimmed,
        usage: {
          inputTokens: approxTokens(fullPrompt),
          outputTokens: approxTokens(trimmed),
        },
      };
    }
    throw error;
  }
}

export async function generateWithCodexCli(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const command = resolveCommand("CODEX_CLI_PATH", "codex");
  const { system, user } = buildPromptText(request);
  const fullPrompt = `${system}\n\n---\n\n${user}`;

  const workDir = await mkdtemp(path.join(tmpdir(), "agenticos-codex-"));
  const outputFile = path.join(workDir, "out.txt");

  const args = [
    "exec",
    "--skip-git-repo-check",
    "--ephemeral",
    "--color",
    "never",
    "-s",
    "read-only",
    "-o",
    outputFile,
  ];
  if (request.model && request.model !== "Codex") {
    args.push("--model", request.model);
  }
  if (request.reasoningEffort) {
    args.push("-c", `model_reasoning_effort=${request.reasoningEffort}`);
  }
  args.push("-");

  try {
    const result = await runCli({
      command,
      args,
      stdin: fullPrompt,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    let content = "";
    try {
      content = (await readFile(outputFile, "utf8")).trim();
    } catch {}

    if (!content) {
      content = stripCodexBanner(result.stdout).trim();
    }

    if (!content) {
      if (result.exitCode !== 0) {
        const errorDetail = extractCodexError(result.stderr) ?? (result.stderr.slice(0, 400) || "no output");
        throw new Error(`Codex CLI exited ${result.exitCode}: ${errorDetail}`);
      }
      throw new Error("Codex CLI returned empty result");
    }

    return {
      content,
      usage: {
        inputTokens: approxTokens(fullPrompt),
        outputTokens: approxTokens(content),
      },
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

function extractCodexError(stderr: string): string | null {
  const errorLines = stderr
    .split("\n")
    .filter((l) => l.trimStart().startsWith("ERROR:"))
    .map((l) => {
      const json = l.replace(/^\s*ERROR:\s*/, "").trim();
      try {
        const parsed = JSON.parse(json) as { error?: { message?: string }; message?: string };
        return parsed.error?.message ?? parsed.message ?? json;
      } catch {
        return json;
      }
    });
  return errorLines.length > 0 ? errorLines[0] : null;
}

function stripCodexBanner(output: string): string {
  const lines = output.split("\n");
  const skipPrefixes = ["codex ", "OpenAI Codex", "Welcome", "Loading", "Working dir", "Model:", "Tools:"];
  const filtered: string[] = [];
  let firstContentSeen = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!firstContentSeen) {
      if (!trimmed) continue;
      if (skipPrefixes.some((p) => trimmed.startsWith(p))) continue;
      firstContentSeen = true;
    }
    filtered.push(line);
  }
  return filtered.join("\n");
}

function stripCopilotOutput(output: string): string {
  return output
    .split("\n")
    .map((line) => line.replace(/^[\s●○◐◓◑◒]+/, "").trimEnd())
    .filter((line, index, lines) => {
      const trimmed = line.trim();
      if (!trimmed) return index > 0 && index < lines.length - 1;
      if (trimmed.startsWith("GitHub Copilot CLI ")) return false;
      if (trimmed.startsWith("Run 'copilot update'")) return false;
      if (trimmed.startsWith("Update available:")) return false;
      if (/^I[’']ll open .*referenced file/i.test(trimmed)) return false;
      if (/^I[’']ll read .*referenced file/i.test(trimmed)) return false;
      return true;
    })
    .join("\n")
    .trim();
}

const COPILOT_FALLBACK_MODELS = [
  "claude-sonnet-4.6",
  "claude-sonnet-4.5",
  "claude-haiku-4.5",
  "claude-opus-4.7",
  "claude-opus-4.6",
  "claude-opus-4.6-fast",
  "claude-opus-4.5",
  "claude-sonnet-4",
  "gpt-5.5",
  "gpt-5.4",
  "gpt-5.3-codex",
  "gpt-5.2-codex",
  "gpt-5.2",
  "gpt-5.1",
  "gpt-5.4-mini",
  "gpt-5-mini",
  "gpt-4.1",
];

function uniqueOrdered(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function parseCopilotHelpModels(output: string): string[] {
  const lines = output.split(/\r?\n/);
  const models: string[] = [];
  let inModelSetting = false;

  for (const line of lines) {
    if (/^\s{2}`model`:/i.test(line)) {
      inModelSetting = true;
      continue;
    }

    if (inModelSetting && /^\s{2}`[^`]+`:/.test(line)) break;

    if (inModelSetting) {
      const match = line.match(/^\s{4}-\s+"([^"]+)"/);
      if (match?.[1]) models.push(match[1]);
    }
  }

  return uniqueOrdered(models);
}

function copilotEffort(effort: string): string {
  return effort === "minimal" ? "low" : effort;
}

export async function listCopilotCliModels(): Promise<string[]> {
  const command = resolveCommand("COPILOT_CLI_PATH", "copilot");
  const result = await runCli({ command, args: ["help", "config"], timeoutMs: 15_000 });
  const models = parseCopilotHelpModels(result.stdout);
  return models.length ? models : COPILOT_FALLBACK_MODELS;
}

export async function generateWithCopilotCli(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const command = resolveCommand("COPILOT_CLI_PATH", "copilot");
  const { system, user } = buildPromptText(request);
  const fullPrompt = `${system}\n\n---\n\n${user}`;
  const workDir = await mkdtemp(path.join(tmpdir(), "agenticos-copilot-"));
  const promptFile = path.join(workDir, "prompt.txt");
  await writeFile(promptFile, fullPrompt, "utf8");

  const args = [
    "-p", "@prompt.txt",
    "--silent",
    "--no-color",
    "--no-auto-update",
    "--no-custom-instructions",
    "--stream", "off",
    "--output-format", "text",
    "--available-tools=",
  ];
  if (request.model && request.model !== "GitHub Copilot CLI") {
    args.push("--model", request.model);
  }
  if (request.reasoningEffort) {
    args.push("--effort", copilotEffort(request.reasoningEffort));
  }

  try {
    const result = await runCli({
      command,
      args,
      cwd: workDir,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    const content = stripCopilotOutput(result.stdout);

    if (!content) {
      if (result.exitCode !== 0) {
        throw new Error(`Copilot CLI exited ${result.exitCode}: ${result.stderr.slice(0, 400) || "no output"}`);
      }
      throw new Error("Copilot CLI returned empty result");
    }

    return {
      content,
      usage: {
        inputTokens: approxTokens(fullPrompt),
        outputTokens: approxTokens(content),
      },
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function generateWithGeminiCli(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const command = resolveCommand("GEMINI_CLI_PATH", "gemini");
  // Strip projectContext — agent markdown files confuse Gemini into treating prompts as code tasks.
  // Run from a temp dir so Gemini doesn't auto-load the agentic-os project structure.
  //
  // On Windows, piping stdin to gemini via Node's spawn(..., {shell:true}) HANGS — the child
  // process never exits. Workaround: write prompt to a file and use shell redirection
  // (`gemini ... < prompt.txt`) which cmd.exe handles correctly.
  const { system, user } = buildPromptText({ ...request, projectContext: undefined });
  const fullPrompt = `${system}\n\n---\n\n${user}`;

  const workDir = await mkdtemp(path.join(tmpdir(), "agenticos-gemini-"));
  const promptFile = path.join(workDir, "prompt.txt");
  await writeFile(promptFile, fullPrompt, "utf8");

  const args = [
    "--output-format", "stream-json",
    "--skip-trust",
    "--approval-mode", "auto_edit",
    "--model", request.model || "gemini-2.5-pro",
    "<", `"${promptFile}"`,
  ];

  try {
    const result = await runCli({
      command,
      args,
      cwd: workDir,
      timeoutMs: DEFAULT_TIMEOUT_MS,
    });

    // Collect all assistant delta messages — without --prompt the agent normally just
    // responds directly with no tool calls, so simple concatenation works.
    type DeltaEvent = { type: string; role?: string; content?: string; delta?: boolean };
    type WriteFileEvent = { type: string; tool_name?: string; parameters?: { content?: string; file_path?: string } };
    const deltas: string[] = [];
    let writeFileContent = "";
    for (const line of result.stdout.split("\n").filter(Boolean)) {
      try {
        const event = JSON.parse(line) as DeltaEvent & WriteFileEvent;
        if (event.type === "message" && event.role === "assistant" && event.delta) {
          deltas.push(event.content ?? "");
        } else if (event.type === "tool_use" && event.tool_name === "write_file" && event.parameters?.content) {
          // If Gemini decides to write to a file, capture that as a higher-quality fallback
          writeFileContent = event.parameters.content.trim();
        }
      } catch { /* skip malformed lines */ }
    }

    // Strip Gemini's chain-of-thought self-talk if present
    let content = deltas.join("").trim();
    const cotMarkers = ["The user asked", "I have provided", "I should now", "I've created", "I have generated", "I've completed", "I have completed"];
    for (const marker of cotMarkers) {
      const idx = content.lastIndexOf(marker);
      if (idx !== -1) content = content.slice(0, idx).trim();
    }

    // Fall back to write_file content if delta content came out empty (e.g. agent wrote to file instead)
    if (!content && writeFileContent) content = writeFileContent;

    if (!content) {
      if (result.exitCode !== 0) {
        throw new Error(`Gemini CLI exited ${result.exitCode}: ${result.stderr.slice(0, 400) || "no output"}`);
      }
      throw new Error("Gemini CLI returned empty result");
    }

    return {
      content,
      usage: {
        inputTokens: approxTokens(fullPrompt),
        outputTokens: approxTokens(content),
      },
    };
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function isGeminiCliAvailable(): Promise<boolean> {
  try {
    const command = resolveCommand("GEMINI_CLI_PATH", "gemini");
    const result = await runCli({ command, args: ["--version"], timeoutMs: 5_000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function isClaudeCliAvailable(): Promise<boolean> {
  try {
    const command = resolveCommand("CLAUDE_CLI_PATH", "claude");
    const result = await runCli({ command, args: ["--version"], timeoutMs: 5_000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function isCodexCliAvailable(): Promise<boolean> {
  try {
    const command = resolveCommand("CODEX_CLI_PATH", "codex");
    const result = await runCli({ command, args: ["--version"], timeoutMs: 5_000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}

export async function isCopilotCliAvailable(): Promise<boolean> {
  try {
    const command = resolveCommand("COPILOT_CLI_PATH", "copilot");
    const result = await runCli({ command, args: ["version", "--no-auto-update"], timeoutMs: 15_000 });
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
