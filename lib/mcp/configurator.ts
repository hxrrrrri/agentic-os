/**
 * Per-CLI MCP configurator.
 *
 * Generates the right config file content for each CLI provider that supports
 * MCP, pulling credential values from the encrypted secret store on demand.
 *
 * Targets:
 *   - claude-code  → project-level .mcp.json (auto-detected at the repo root)
 *   - codex        → ~/.codex/mcp.json
 *   - gemini-cli   → ~/.gemini/settings.json (mcpServers key)
 */

import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { agenticosConfig } from "@/agenticos.config";
import { getSecret } from "@/lib/secrets/store";
import { findMcpSpec, MCP_CATALOG, type McpServerSpec } from "@/lib/mcp/catalog";

export type CliTarget = "claude-code" | "codex" | "gemini-cli";

export const CLI_TARGETS: CliTarget[] = ["claude-code", "codex", "gemini-cli"];

interface McpServerEntry {
  command: string;
  args: string[];
  env?: Record<string, string>;
}

function configPath(target: CliTarget): string {
  switch (target) {
    case "claude-code":
      // Project-scoped — Claude Code reads .mcp.json from the cwd.
      return path.join(process.cwd(), ".mcp.json");
    case "codex":
      return path.join(os.homedir(), ".codex", "mcp.json");
    case "gemini-cli":
      return path.join(os.homedir(), ".gemini", "settings.json");
  }
}

async function readConfig(target: CliTarget): Promise<Record<string, unknown>> {
  const file = configPath(target);
  try {
    const raw = await fsp.readFile(file, "utf8");
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function getServersBlock(target: CliTarget, doc: Record<string, unknown>): Record<string, McpServerEntry> {
  if (target === "gemini-cli") {
    const block = (doc.mcpServers as Record<string, McpServerEntry> | undefined) ?? {};
    return block;
  }
  return (doc.mcpServers as Record<string, McpServerEntry> | undefined) ?? {};
}

function setServersBlock(target: CliTarget, doc: Record<string, unknown>, servers: Record<string, McpServerEntry>): Record<string, unknown> {
  return { ...doc, mcpServers: servers };
}

async function writeConfig(target: CliTarget, doc: Record<string, unknown>): Promise<void> {
  const file = configPath(target);
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(doc, null, 2), "utf8");
}

function substituteArgs(spec: McpServerSpec, args: string[]): string[] {
  return args.map((arg) => {
    if (arg === "__VAULT_PATH__") return path.resolve(agenticosConfig.vaultPath);
    if (arg === "__REPO_ROOT__") return process.cwd();
    if (arg === "__DB_PATH__") return path.resolve(agenticosConfig.databasePath);
    return arg;
  });
}

async function buildServerEntry(spec: McpServerSpec): Promise<McpServerEntry> {
  // Resolve credentials from the encrypted store (and env fallback inside).
  const env: Record<string, string> = { ...(spec.staticEnv ?? {}) };
  if (spec.envMap) {
    for (const [secretKey, envKey] of Object.entries(spec.envMap)) {
      const value = await getSecret(secretKey);
      if (value) env[envKey] = value;
    }
  }

  // Forward our own auth context so the local server can reach back when
  // AGENTICOS_AUTH_TOKEN is set.
  if (spec.id === "agenticos") {
    if (process.env.AGENTICOS_AUTH_TOKEN) env.AGENTICOS_AUTH_TOKEN = process.env.AGENTICOS_AUTH_TOKEN;
    env.AGENTICOS_BASE_URL = process.env.AGENTICOS_PUBLIC_URL ?? "http://127.0.0.1:3000";
  }

  switch (spec.runtime) {
    case "npx": {
      const isWin = process.platform === "win32";
      return {
        command: isWin ? "npx.cmd" : "npx",
        args: ["-y", spec.package, ...substituteArgs(spec, spec.args ?? [])],
        env: Object.keys(env).length ? env : undefined,
      };
    }
    case "uvx": {
      return {
        command: "uvx",
        args: [spec.package, ...substituteArgs(spec, spec.args ?? [])],
        env: Object.keys(env).length ? env : undefined,
      };
    }
    case "node-local": {
      return {
        command: process.execPath,
        args: [path.resolve(process.cwd(), spec.package), ...substituteArgs(spec, spec.args ?? [])],
        env: Object.keys(env).length ? env : undefined,
      };
    }
  }
}

export interface InstallResult {
  ok: boolean;
  configPath: string;
  serverId: string;
  target: CliTarget;
  error?: string;
}

export async function installServer(serverId: string, target: CliTarget): Promise<InstallResult> {
  const spec = findMcpSpec(serverId);
  if (!spec) return { ok: false, configPath: configPath(target), serverId, target, error: `Unknown server: ${serverId}` };
  try {
    const entry = await buildServerEntry(spec);
    const doc = await readConfig(target);
    const servers = getServersBlock(target, doc);
    servers[serverId] = entry;
    await writeConfig(target, setServersBlock(target, doc, servers));
    return { ok: true, configPath: configPath(target), serverId, target };
  } catch (err) {
    return { ok: false, configPath: configPath(target), serverId, target, error: err instanceof Error ? err.message : "install failed" };
  }
}

export async function uninstallServer(serverId: string, target: CliTarget): Promise<InstallResult> {
  try {
    const doc = await readConfig(target);
    const servers = getServersBlock(target, doc);
    delete servers[serverId];
    await writeConfig(target, setServersBlock(target, doc, servers));
    return { ok: true, configPath: configPath(target), serverId, target };
  } catch (err) {
    return { ok: false, configPath: configPath(target), serverId, target, error: err instanceof Error ? err.message : "uninstall failed" };
  }
}

export interface ServerStatus {
  serverId: string;
  installed: Record<CliTarget, boolean>;
}

export async function listAllStatus(): Promise<ServerStatus[]> {
  const docs: Record<CliTarget, Record<string, unknown>> = {
    "claude-code": await readConfig("claude-code"),
    codex: await readConfig("codex"),
    "gemini-cli": await readConfig("gemini-cli"),
  };
  return MCP_CATALOG.map((spec) => {
    const installed: ServerStatus["installed"] = {
      "claude-code": Boolean(getServersBlock("claude-code", docs["claude-code"])[spec.id]),
      codex: Boolean(getServersBlock("codex", docs.codex)[spec.id]),
      "gemini-cli": Boolean(getServersBlock("gemini-cli", docs["gemini-cli"])[spec.id]),
    };
    return { serverId: spec.id, installed };
  });
}

export function getConfigPath(target: CliTarget): string {
  return configPath(target);
}

export interface ServerCredStatus {
  serverId: string;
  /** Missing credentials (registry keys) that the server needs but the secret store lacks. */
  missing: string[];
}

export async function checkCredentials(serverId: string): Promise<ServerCredStatus> {
  const spec = findMcpSpec(serverId);
  if (!spec) return { serverId, missing: [] };
  const missing: string[] = [];
  if (spec.envMap) {
    for (const secretKey of Object.keys(spec.envMap)) {
      if (!(await getSecret(secretKey))) missing.push(secretKey);
    }
  }
  return { serverId, missing };
}
