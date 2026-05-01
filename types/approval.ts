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
}

export interface AuditLog {
  id: string;
  timestamp: string;
  actor: "user" | "agent" | "system";
  action: string;
  integration?: string;
  riskLevel: RiskLevel;
  result: "allowed" | "blocked" | "approved" | "rejected" | "completed" | "failed";
}
