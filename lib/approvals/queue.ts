/**
 * Generic approval queue.
 *
 * `proposeAction` records an approval row + optional auto-fire callback that
 * runs only when the approval flips to "approved". Until then, the action is
 * deferred. Push/webhook notifications fire automatically.
 */

import { insertApproval, getApproval } from "@/lib/db/repositories";
import { createId, nowIso } from "@/lib/utils";
import { pushNotification, isPushConfigured } from "@/lib/notify/push";
import { sendWebhookEvent } from "@/lib/notify/webhook";
import type { ApprovalRequest, RiskLevel } from "@/types";

export interface ProposeOptions {
  runId?: string;
  action: string;
  integration: string;
  affectedResource: string;
  commandOrPayload: string;
  riskLevel: RiskLevel;
  explanation: string;
}

export async function proposeAction(opts: ProposeOptions): Promise<ApprovalRequest> {
  const approval: ApprovalRequest = {
    id: createId("approval"),
    runId: opts.runId ?? "",
    action: opts.action,
    integration: opts.integration,
    affectedResource: opts.affectedResource,
    commandOrPayload: opts.commandOrPayload,
    riskLevel: opts.riskLevel,
    explanation: opts.explanation,
    status: "pending",
    createdAt: nowIso(),
  };
  await insertApproval(approval);

  if (isPushConfigured()) {
    void pushNotification({
      title: `Approval needed: ${approval.action}`,
      message: `Risk ${approval.riskLevel} · ${approval.integration} · ${approval.affectedResource}`,
      priority: approval.riskLevel === "critical" ? "urgent" : "high",
      tags: ["warning", approval.riskLevel],
      click: `${process.env.AGENTICOS_PUBLIC_URL ?? "http://localhost:3000"}/approvals`,
    });
  }
  void sendWebhookEvent({
    title: `Approval needed: ${approval.action}`,
    message: `Risk ${approval.riskLevel} · ${approval.integration} · ${approval.affectedResource}`,
    level: "warn",
    runId: approval.runId,
  });

  return approval;
}

export async function awaitApproval(approvalId: string, timeoutMs = 5 * 60_000, pollMs = 1_500): Promise<ApprovalRequest> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const approval = await getApproval(approvalId);
    if (!approval) throw new Error(`Approval ${approvalId} not found`);
    if (approval.status !== "pending") return approval;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`Approval ${approvalId} timed out after ${timeoutMs}ms`);
}

export async function runApproved<T>(
  opts: ProposeOptions,
  perform: (approval: ApprovalRequest) => Promise<T>,
  options: { waitMs?: number } = {},
): Promise<{ approval: ApprovalRequest; result?: T }> {
  const approval = await proposeAction(opts);
  // Don't block the HTTP response — fire-and-forget the wait.
  if (options.waitMs === 0) return { approval };
  const final = await awaitApproval(approval.id, options.waitMs ?? 5 * 60_000);
  if (final.status !== "approved") return { approval: final };
  const result = await perform(final);
  return { approval: final, result };
}
