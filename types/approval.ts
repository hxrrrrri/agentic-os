import type { RiskLevel } from "./skill";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "expired";

export interface ApprovalRequest {
  id: string;
  runId: string;
  action: string;
  integration: string;
  affectedResource: string;
  commandOrPayload: string;
  riskLevel: RiskLevel;
  explanation: string;
  status: ApprovalStatus;
  createdAt: string;
  resolvedAt?: string;
  /** Approval auto-expires at this ISO timestamp if still pending. The
   *  recovery sweep (`expireStaleApprovals`) marks it `expired`. */
  expiresAt?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: "user" | "agent" | "system" | "scheduler" | "swarm" | "mcp";
  action: string;
  integration?: string;
  riskLevel: RiskLevel;
  result: "allowed" | "blocked" | "approved" | "rejected" | "completed" | "failed";
}
