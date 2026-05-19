import type { RiskLevel } from "./skill";

export interface ToolDefinition {
  /** Canonical name (e.g. "render_carousel", "gmail_search"). */
  name: string;
  description: string;
  /** JSON schema for arguments. Used by tool-using providers. */
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  /** Risk for the call. Writes default to medium/high. */
  riskLevel: RiskLevel;
  /** When true, the dispatcher must wait for human approval before running. */
  requiresApproval?: boolean;
  /** Group label for UI filtering. */
  group: "artifact" | "integration" | "vault" | "mcp" | "system";
}

export interface ToolCallRequest {
  name: string;
  args: Record<string, unknown>;
  /** Source provider call id (for replying). */
  providerCallId?: string;
}

export interface ToolCallResult {
  callId: string;
  ok: boolean;
  /** Short, model-friendly summary. */
  summary: string;
  /** Optional structured data. */
  data?: unknown;
  /** Optional artifact ids produced. */
  artifactIds?: string[];
  /** Error message on failure. */
  error?: string;
}
