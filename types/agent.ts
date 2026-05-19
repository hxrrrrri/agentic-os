import type { ExecutionMode, RiskLevel, SkillCategory } from "./skill";

export interface AgentPlanStep {
  id: string;
  title: string;
  description: string;
  expectedTool?: string;
  riskLevel: RiskLevel;
  requiresApproval: boolean;
}

export interface AgentPlanRouting {
  skillId?: string;
  confidence: number;
  reason: string;
  tokensUsed?: number;
  candidates?: Array<{ id: string; score: number }>;
}

export interface AgentPlan {
  id: string;
  runId: string;
  category: SkillCategory | "unknown";
  summary: string;
  executionMode: ExecutionMode;
  steps: AgentPlanStep[];
  createdAt: string;
  /** Auto-router decision when no manual skill was selected. */
  routing?: AgentPlanRouting;
}

export interface Workflow {
  id: string;
  name: string;
  skillIds: string[];
  description: string;
  defaultOutputLocation: string;
}

export type ModelProvider =
  | "claude-code"
  | "codex"
  | "copilot-cli"
  | "gemini-cli"
  | "ollama"
  | "openai"
  | "openrouter"
  | "gemini"
  | "grok"
  | "anthropic"
  | "nvidia"
  | "local"
  | "custom";

export interface ModelEndpoint {
  id: string;
  provider: ModelProvider;
  model: string;
  models?: string[];
  baseUrl?: string;
  mode: "cloud" | "local" | "cli";
  enabled: boolean;
  dynamicModels?: boolean;
  requiresApiKey?: boolean;
}

export type ThinkingLevel = "off" | "think" | "think-hard" | "think-harder" | "ultrathink";
export type ReasoningEffort = "minimal" | "low" | "medium" | "high" | "xhigh";

export interface SelectedModelProfile {
  providerId: string;
  model: string;
  thinking?: ThinkingLevel;
  reasoningEffort?: ReasoningEffort;
}
