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
  /** Enable tool-use loop. When set, engine routes generation through the tool dispatcher and the model can call registered tools. */
  useTools?: boolean;
  /** Allowed tool names (artifact/integration). Empty/undefined = all registered tools that match the skill's risk envelope. */
  tools?: string[];
  /** Number of variants to generate in parallel (1 = single shot). */
  variants?: number;
}
