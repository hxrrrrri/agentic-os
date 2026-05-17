import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";

export interface CliAdapter {
  id: string;
  label: string;
  command: string;
  args: string[];
  envVar?: string;
  aliases?: string[];
  installHint?: string;
}

export const CLI_ADAPTERS: CliAdapter[] = [
  {
    id: "claude-code",
    label: "Claude Code",
    command: "claude",
    args: [],
    envVar: "CLAUDE_CLI_PATH",
    aliases: ["claude"],
    installHint: "npm install -g @anthropic-ai/claude-code",
  },
  {
    id: "codex",
    label: "Codex CLI",
    command: "codex",
    args: [],
    envVar: "CODEX_CLI_PATH",
    installHint: "npm install -g @openai/codex",
  },
  {
    id: "gemini-cli",
    label: "Gemini CLI",
    command: "gemini",
    args: [],
    envVar: "GEMINI_CLI_PATH",
    aliases: ["gemini"],
    installHint: "npm install -g @google/gemini-cli",
  },
  {
    id: "copilot-cli",
    label: "GitHub Copilot",
    command: "copilot",
    args: [],
    envVar: "COPILOT_CLI_PATH",
    aliases: ["copilot"],
    installHint: "npm install -g @github/copilot",
  },
  {
    id: "ollama",
    label: "Ollama",
    command: "ollama",
    args: ["run", process.env.OLLAMA_MODEL ?? "llama3"],
    envVar: "OLLAMA_CLI_PATH",
    installHint: "Install Ollama and run `ollama pull llama3.2` or set OLLAMA_MODEL.",
  },
  {
    id: "aider",
    label: "Aider",
    command: "aider",
    args: [],
    envVar: "AIDER_CLI_PATH",
    installHint: "pipx install aider-chat",
  },
  {
    id: "amp",
    label: "Amp",
    command: "amp",
    args: [],
    envVar: "AMP_CLI_PATH",
    installHint: "Install Amp and ensure `amp` is on PATH.",
  },
  {
    id: "shell",
    label: "Shell",
    command: process.platform === "win32" ? "cmd.exe" : "bash",
    args: process.platform === "win32" ? [] : ["--norc"],
  },
];

export function getAdapter(id: string): CliAdapter | undefined {
  return CLI_ADAPTERS.find((a) => a.id === id || a.aliases?.includes(id));
}

export function resolveCommand(adapter: CliAdapter): string {
  if (adapter.envVar && process.env[adapter.envVar]) {
    return process.env[adapter.envVar]!;
  }
  return adapter.command;
}

const execFileAsync = promisify(execFile);

function looksLikePath(command: string) {
  return command.includes("/") || command.includes("\\") || /^[A-Za-z]:/.test(command);
}

export async function isCommandAvailable(adapter: CliAdapter): Promise<boolean> {
  if (adapter.id === "shell") return true;

  const command = resolveCommand(adapter).trim();
  if (!command) return false;

  if (looksLikePath(command)) {
    return fs.existsSync(command);
  }

  try {
    if (process.platform === "win32") {
      await execFileAsync("where.exe", [command], { timeout: 3000 });
    } else {
      await execFileAsync("sh", ["-lc", `command -v ${JSON.stringify(command)}`], { timeout: 3000 });
    }
    return true;
  } catch {
    return false;
  }
}

export interface CliAdapterStatus {
  id: string;
  label: string;
  available: boolean;
  command: string;
  installHint?: string;
}

export async function getAdapterStatus(adapter: CliAdapter): Promise<CliAdapterStatus> {
  const available = await isCommandAvailable(adapter);
  return {
    id: adapter.id,
    label: adapter.label,
    available,
    command: resolveCommand(adapter),
    installHint: adapter.installHint,
  };
}
