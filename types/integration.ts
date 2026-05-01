import type { RiskLevel } from "./skill";

export type IntegrationStatus = "connected" | "partial" | "disconnected" | "not_configured";
export type PermissionLevel =
  | "read-only"
  | "draft-only"
  | "approval-required"
  | "auto-execute-allowed"
  | "disabled";

export interface IntegrationAction {
  id: string;
  name: string;
  riskLevel: RiskLevel;
  permissionLevel: PermissionLevel;
}

export interface Integration {
  id: string;
  name: string;
  status: IntegrationStatus;
  mode: "mock" | "real";
  description: string;
  actions: IntegrationAction[];
  lastUsed?: string;
  enabled: boolean;
}
