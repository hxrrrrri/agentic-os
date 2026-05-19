import type { RiskLevel } from "./skill";

export type RunStatus =
  | "queued"
  | "planning"
  | "running"
  | "waiting_for_approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface RunStep {
  id: string;
  runId: string;
  index: number;
  title: string;
  status: RunStatus;
  startedAt?: string;
  endedAt?: string;
  observation?: string;
}

export interface ToolCall {
  id: string;
  runId: string;
  stepId?: string;
  tool: string;
  action: string;
  input: string;
  output?: string;
  riskLevel: RiskLevel;
  status: "planned" | "executed" | "blocked" | "failed";
  createdAt: string;
}

export interface Run {
  id: string;
  title: string;
  prompt: string;
  selectedSkill?: string;
  category: string;
  status: RunStatus;
  startedAt: string;
  endedAt?: string;
  durationMs?: number;
  tokensEstimate: number;
  costEstimate: number;
  steps: RunStep[];
  toolCalls: ToolCall[];
  approvals: string[];
  filesTouched: string[];
  errors: string[];
  /** Verbose error context — stack trace and provider response body. Surfaced
   *  on the run detail page when status === "failed" so debugging doesn't
   *  require digging through logs. */
  errorDetail?: string;
  finalOutput?: string;
  createdArtifacts: string[];
  /** Structured artifact records (carousels, images, etc.). Backed by the
   *  `artifacts_json` column. Optional so legacy rows without the column
   *  still parse cleanly. */
  artifacts?: import("./artifact").GeneratedArtifact[];
}
