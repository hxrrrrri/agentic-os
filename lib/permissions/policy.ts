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
] as const;

export function requiresApproval(riskLevel: RiskLevel, permissionLevel: PermissionLevel = "approval-required"): boolean {
  if (permissionLevel === "disabled") return true;
  if (permissionLevel === "read-only") return rank[riskLevel] >= rank.medium;
  if (permissionLevel === "draft-only") return rank[riskLevel] >= rank.high;
  if (permissionLevel === "auto-execute-allowed") return rank[riskLevel] >= rank.high;
  return rank[riskLevel] >= rank.medium;
}

export function detectRisk(action: string): RiskLevel {
  const lower = action.toLowerCase();
  if (riskyActionTerms.some((term) => lower.includes(term))) {
    if (["charge", "refund", "secret", "delete", "modify production"].some((t) => lower.includes(t))) return "critical";
    return "high";
  }
  if (["push", "publish", "send", "shell", "install"].some((term) => lower.includes(term))) return "high";
  if (["draft", "move", "update", "create"].some((term) => lower.includes(term))) return "medium";
  return "low";
}
