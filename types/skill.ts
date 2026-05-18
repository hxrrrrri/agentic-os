export type SkillCategory =
  | "memory"
  | "productivity"
  | "research"
  | "content"
  | "custom"
  | "dev"
  | "business";

export type RiskLevel = "low" | "medium" | "high" | "critical";
export type ExecutionMode = "dry-run" | "approval" | "auto";
export type CostTier = "cheap" | "default" | "premium";

export interface Skill {
  id: string;
  name: string;
  category: SkillCategory;
  description: string;
  template: string;
  requiredIntegrations: string[];
  riskLevel: RiskLevel;
  outputLocation: string;
  enabled: boolean;
  executionMode: ExecutionMode;
  /** Cost governor hint: cheap routes to mini/local, premium to flagship. Optional; default honors active profile. */
  costTier?: CostTier;
}
