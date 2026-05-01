export type TriggerType =
  | "manual"
  | "schedule"
  | "webhook"
  | "file-change"
  | "desktop-trigger-placeholder"
  | "email-received-placeholder"
  | "calendar-event-placeholder";

export interface Routine {
  id: string;
  name: string;
  description: string;
  skillId: string;
  schedule: string;
  triggerType: TriggerType;
  enabled: boolean;
  lastRun?: string;
  nextRun?: string;
  approvalMode: "dry-run" | "approval" | "auto";
  outputDestination: string;
}
