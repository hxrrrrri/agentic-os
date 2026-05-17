import { execFileSync } from "node:child_process";
import { spawn as spawnPty, type IPty } from "@homebridge/node-pty-prebuilt-multiarch";
import { agenticosConfig } from "@/agenticos.config";
import { createId } from "@/lib/utils";
import { getAdapter, isCommandAvailable, resolveCommand, type CliAdapter } from "@/lib/terminal/adapters";

const TERMINAL_ENV: Record<string, string | undefined> = {
  ...process.env,
  FORCE_COLOR: "3",
  COLORTERM: "truecolor",
  TERM: "xterm-256color",
  TERM_PROGRAM: "AgenticOS",
};
delete TERMINAL_ENV.NO_COLOR;

export interface SessionInfo {
  id: string;
  cliId: string;
  cliLabel: string;
  alive: boolean;
  startedAt: string;
  historySize: number;
}

interface LiveSession {
  id: string;
  cliId: string;
  cliLabel: string;
  proc: IPty;
  history: string[];
  alive: boolean;
  startedAt: string;
  outputSubs: Set<(chunk: string) => void>;
  exitSubs: Set<(code: number) => void>;
}

const sessions = new Map<string, LiveSession>();

function pushChunk(session: LiveSession, raw: string): void {
  if (!raw) return;
  session.history.push(raw);
  if (session.history.length > 4000) session.history.shift();
  session.outputSubs.forEach((fn) => fn(raw));
}

function shellCommand() {
  if (process.platform === "win32") return process.env.COMSPEC || "cmd.exe";
  return process.env.SHELL || "bash";
}

function quoteWindowsArg(value: string) {
  if (!/[ \t&()^|<>"]/.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function windowsCommandLine(command: string, args: string[]) {
  return [quoteWindowsArg(command), ...args.map(quoteWindowsArg)].join(" ");
}

function spawnTerminal(adapter: CliAdapter): IPty {
  const command = resolveCommand(adapter);
  const env = TERMINAL_ENV as Record<string, string>;
  const common = {
    name: "xterm-256color",
    cols: 120,
    rows: 24,
    cwd: agenticosConfig.vaultPath,
    env,
  };

  if (adapter.id === "shell") {
    return spawnPty(shellCommand(), process.platform === "win32" ? [] : adapter.args, {
      ...common,
      useConpty: false,
    });
  }

  if (process.platform === "win32") {
    // npm and Volta CLIs often resolve to .cmd shims. Launching through cmd.exe gives them a
    // console-backed PTY without the child_process pipe behavior that broke interactive sessions.
    return spawnPty(shellCommand(), ["/d", "/s", "/c", windowsCommandLine(command, adapter.args)], {
      ...common,
      useConpty: false,
    });
  }

  return spawnPty(command, adapter.args, common);
}

function createPtySession(adapter: CliAdapter, requestedId = adapter.id, requestedLabel = adapter.label): SessionInfo {
  const id = createId("term");
  const startedAt = new Date().toISOString();
  const proc = spawnTerminal(adapter);

  const session: LiveSession = {
    id,
    cliId: requestedId,
    cliLabel: requestedLabel,
    proc,
    history: [],
    alive: true,
    startedAt,
    outputSubs: new Set(),
    exitSubs: new Set(),
  };

  proc.onData((chunk) => pushChunk(session, chunk));
  proc.onExit(({ exitCode }) => {
    pushChunk(session, `\r\n[${requestedLabel} exited: code ${exitCode ?? 0}]\r\n`);
    session.alive = false;
    const code = exitCode ?? 0;
    session.exitSubs.forEach((fn) => fn(code));
    sessions.delete(id);
  });

  sessions.set(id, session);
  return { id, cliId: requestedId, cliLabel: requestedLabel, alive: true, startedAt, historySize: 0 };
}

function createShellFallback(cliId: string, label: string, message: string): SessionInfo {
  const shellAdapter: CliAdapter = {
    id: "shell",
    label: "Shell",
    command: shellCommand(),
    args: process.platform === "win32" ? [] : ["--norc"],
  };
  const info = createPtySession(shellAdapter, cliId, label);
  const live = sessions.get(info.id);
  if (live) {
    pushChunk(
      live,
      `\r\n[${label} unavailable]\r\n${message}\r\n[Opened a shell in ${agenticosConfig.vaultPath} instead.]\r\n\r\n`,
    );
  }
  return info;
}

export async function createSession(cliId: string): Promise<SessionInfo> {
  const adapter = getAdapter(cliId);
  if (!adapter) throw new Error(`Unknown CLI adapter: ${cliId}`);

  const available = await isCommandAvailable(adapter);
  if (!available) {
    const envName = adapter.envVar ?? `${adapter.id.toUpperCase().replaceAll("-", "_")}_CLI_PATH`;
    return createShellFallback(
      adapter.id,
      adapter.label,
      [
        `Command not found: ${resolveCommand(adapter)}.`,
        `Install it or set ${envName}.`,
        adapter.installHint ? `Suggested install: ${adapter.installHint}` : undefined,
      ].filter(Boolean).join("\r\n"),
    );
  }

  try {
    return createPtySession(adapter);
  } catch (error) {
    return createShellFallback(
      adapter.id,
      adapter.label,
      `Could not start ${adapter.label}: ${error instanceof Error ? error.message : "unknown error"}`,
    );
  }
}

export function getSession(id: string): LiveSession | undefined {
  return sessions.get(id);
}

export function listSessions(): SessionInfo[] {
  return Array.from(sessions.values()).map((s) => ({
    id: s.id,
    cliId: s.cliId,
    cliLabel: s.cliLabel,
    alive: s.alive,
    startedAt: s.startedAt,
    historySize: s.history.length,
  }));
}

export function sendInput(sessionId: string, line: string): void {
  const session = sessions.get(sessionId);
  if (!session?.alive) throw new Error("Session not found or already exited");
  session.proc.write(`${line}\r`);
}

export function sendRaw(sessionId: string, data: string): void {
  const session = sessions.get(sessionId);
  if (!session?.alive) throw new Error("Session not found or already exited");
  session.proc.write(data);
}

export function resizeSession(sessionId: string, cols: number, rows: number): void {
  const session = sessions.get(sessionId);
  if (!session?.alive) return;
  try {
    session.proc.resize(cols, rows);
  } catch {}
}

export function killSession(sessionId: string): void {
  const session = sessions.get(sessionId);
  if (!session) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill.exe", ["/PID", String(session.proc.pid), "/T", "/F"], { stdio: "ignore" });
    }
    session.proc.kill();
  } catch {}
  sessions.delete(sessionId);
}

export function subscribeSession(
  sessionId: string,
  onChunk: (chunk: string) => void,
  onExit: (code: number) => void,
): () => void {
  const session = sessions.get(sessionId);
  if (!session) throw new Error("Session not found");

  for (const chunk of session.history) onChunk(chunk);

  session.outputSubs.add(onChunk);
  session.exitSubs.add(onExit);

  return () => {
    session.outputSubs.delete(onChunk);
    session.exitSubs.delete(onExit);
  };
}
