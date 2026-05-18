import { spawn, ChildProcess } from "node:child_process";
import { detectRisk } from "@/lib/permissions/policy";
import { redact } from "@/lib/secrets/redact";
import type { RiskLevel } from "@/types";

export interface McpServerConfig {
  id: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
}

export interface McpTool {
  serverId: string;
  name: string;
  description: string;
  riskLevel: RiskLevel;
  inputSchema?: Record<string, unknown>;
}

interface McpSession {
  config: McpServerConfig;
  process: ChildProcess;
  nextId: number;
  pending: Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>;
  buffer: string;
}

const sessions = new Map<string, McpSession>();

function startSession(config: McpServerConfig): McpSession {
  const child = spawn(config.command, config.args ?? [], {
    env: { ...process.env, ...(config.env ?? {}) },
    stdio: ["pipe", "pipe", "pipe"],
  });
  const session: McpSession = {
    config,
    process: child,
    nextId: 1,
    pending: new Map(),
    buffer: "",
  };
  child.stdout?.on("data", (chunk: Buffer) => {
    session.buffer += chunk.toString("utf8");
    let idx;
    while ((idx = session.buffer.indexOf("\n")) >= 0) {
      const line = session.buffer.slice(0, idx).trim();
      session.buffer = session.buffer.slice(idx + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } };
        if (typeof msg.id === "number" && session.pending.has(msg.id)) {
          const handler = session.pending.get(msg.id)!;
          session.pending.delete(msg.id);
          if (msg.error) handler.reject(new Error(msg.error.message ?? "MCP error"));
          else handler.resolve(msg.result);
        }
      } catch {
        // ignore malformed frames
      }
    }
  });
  child.on("exit", () => {
    sessions.delete(config.id);
  });
  return session;
}

function send<T>(session: McpSession, method: string, params?: Record<string, unknown>, timeoutMs = 15_000): Promise<T> {
  const id = session.nextId++;
  const frame = JSON.stringify({ jsonrpc: "2.0", id, method, params: params ?? {} }) + "\n";
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      session.pending.delete(id);
      reject(new Error(`MCP timeout: ${method}`));
    }, timeoutMs);
    session.pending.set(id, {
      resolve: (v) => {
        clearTimeout(timer);
        resolve(v as T);
      },
      reject: (e) => {
        clearTimeout(timer);
        reject(e);
      },
    });
    session.process.stdin?.write(frame);
  });
}

export async function connectMcpServer(config: McpServerConfig): Promise<void> {
  if (sessions.has(config.id)) return;
  const session = startSession(config);
  sessions.set(config.id, session);
  await send(session, "initialize", {
    protocolVersion: "2024-11-05",
    capabilities: {},
    clientInfo: { name: "AgenticOS", version: "0.1.0" },
  });
}

export async function listMcpTools(serverId: string): Promise<McpTool[]> {
  const session = sessions.get(serverId);
  if (!session) throw new Error(`MCP server not connected: ${serverId}`);
  const result = await send<{ tools?: Array<{ name: string; description?: string; inputSchema?: Record<string, unknown> }> }>(
    session,
    "tools/list",
  );
  return (result.tools ?? []).map((tool) => ({
    serverId,
    name: tool.name,
    description: tool.description ?? "",
    riskLevel: detectRisk(`${tool.name} ${tool.description ?? ""}`),
    inputSchema: tool.inputSchema,
  }));
}

export async function callMcpTool(
  serverId: string,
  toolName: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const session = sessions.get(serverId);
  if (!session) throw new Error(`MCP server not connected: ${serverId}`);
  const raw = await send(session, "tools/call", { name: toolName, arguments: args });
  return redact(raw);
}

export function disconnectMcp(serverId: string) {
  const session = sessions.get(serverId);
  if (!session) return;
  session.process.kill();
  sessions.delete(serverId);
}

export function listConnectedServers(): string[] {
  return Array.from(sessions.keys());
}
