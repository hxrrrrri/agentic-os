import type { PermissionLevel, RiskLevel } from "@/types";

const rank: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 };

export const riskyActionTerms = [
  "send email",
  "delete",
  "modify production",
  "push",
  "charge",
  "refund",
  "customer data",
  "publish",
  "shell",
  "secret",
  "install",
  "api write",
];

export function requiresApproval(riskLevel: RiskLevel, permissionLevel: PermissionLevel = "approval-required") {
  if (permissionLevel === "disabled") return true;
  if (permissionLevel === "auto-execute-allowed" && rank[riskLevel] <= rank.medium) return false;
  if (permissionLevel === "read-only" && rank[riskLevel] <= rank.low) return false;
  if (permissionLevel === "draft-only" && rank[riskLevel] <= rank.medium) return false;
  return rank[riskLevel] >= rank.medium || permissionLevel === "approval-required";
}

export function detectRisk(action: string): RiskLevel {
  const lower = action.toLowerCase();
  if (["charge", "refund", "secret", "delete"].some((term) => lower.includes(term))) return "critical";
  if (["push", "publish", "send", "shell", "install"].some((term) => lower.includes(term))) return "high";
  if (["draft", "move", "update", "create"].some((term) => lower.includes(term))) return "medium";
  return "low";
}
