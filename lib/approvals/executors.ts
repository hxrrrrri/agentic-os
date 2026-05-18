/**
 * Approval executors — registry mapping `integration` → handler that runs the
 * approved action and returns a result object.
 *
 * Each executor receives the full ApprovalRequest. The expected schema of
 * `commandOrPayload` is defined alongside the API route that enqueued it.
 *
 * After a write succeeds, the executor logs an audit row. Failures bubble up
 * to the approval PATCH endpoint and are surfaced in the UI.
 */

import { addAuditLog } from "@/lib/db/repositories";
import { executeGithubApproval } from "@/lib/approvals/github-executor";
import { refundCharge, cancelSubscription } from "@/lib/integrations/stripe";
import { cancelOrder } from "@/lib/integrations/shopify";
import { createDraft, sendMessage } from "@/lib/integrations/gmail";
import type { ApprovalRequest } from "@/types";

interface ExecutorResult {
  ok: boolean;
  result?: unknown;
  error?: string;
}

function parsePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

interface StripeRefundPayload {
  chargeId?: string;
  amount?: number;
  reason?: string;
}
interface StripeCancelPayload {
  subscriptionId?: string;
}
interface ShopifyCancelPayload {
  orderId?: number | string;
  email?: boolean;
  reason?: string;
}
interface GmailDraftPayload {
  to?: string;
  subject?: string;
  body?: string;
  from?: string;
  send?: boolean; // true → send immediately on approve; false → create draft only
}

async function executeStripe(approval: ApprovalRequest): Promise<ExecutorResult> {
  try {
    if (approval.action.startsWith("Stripe refund ")) {
      const p = parsePayload<StripeRefundPayload>(approval.commandOrPayload);
      if (!p?.chargeId) throw new Error("Malformed refund payload");
      const result = await refundCharge(p.chargeId, p.amount, p.reason);
      await addAuditLog({
        actor: "user",
        action: `executed approved Stripe refund on ${p.chargeId}`,
        integration: "stripe",
        riskLevel: "critical",
        result: "completed",
      });
      return { ok: true, result };
    }
    if (approval.action.startsWith("Stripe cancel subscription ")) {
      const p = parsePayload<StripeCancelPayload>(approval.commandOrPayload);
      if (!p?.subscriptionId) throw new Error("Malformed cancel payload");
      const result = await cancelSubscription(p.subscriptionId);
      await addAuditLog({
        actor: "user",
        action: `executed approved Stripe subscription cancel ${p.subscriptionId}`,
        integration: "stripe",
        riskLevel: "critical",
        result: "completed",
      });
      return { ok: true, result };
    }
    return { ok: false, error: `Unknown Stripe approval action: ${approval.action}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Stripe approval execution failed" };
  }
}

async function executeShopify(approval: ApprovalRequest): Promise<ExecutorResult> {
  try {
    if (approval.action.startsWith("Shopify cancel order ")) {
      const p = parsePayload<ShopifyCancelPayload>(approval.commandOrPayload);
      if (!p?.orderId) throw new Error("Malformed cancel payload");
      const result = await cancelOrder(p.orderId, { email: p.email, reason: p.reason });
      await addAuditLog({
        actor: "user",
        action: `executed approved Shopify cancel ${p.orderId}`,
        integration: "shopify",
        riskLevel: "high",
        result: "completed",
      });
      return { ok: true, result };
    }
    return { ok: false, error: `Unknown Shopify approval action: ${approval.action}` };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Shopify approval execution failed" };
  }
}

async function executeGmail(approval: ApprovalRequest): Promise<ExecutorResult> {
  try {
    const p = parsePayload<GmailDraftPayload>(approval.commandOrPayload);
    if (!p?.to || !p.subject || !p.body) throw new Error("Malformed gmail payload");
    if (p.send) {
      const result = await sendMessage(p.to, p.subject, p.body, p.from);
      await addAuditLog({
        actor: "user",
        action: `executed approved Gmail send to ${p.to}`,
        integration: "gmail",
        riskLevel: "critical",
        result: "completed",
      });
      return { ok: true, result };
    }
    const result = await createDraft(p.to, p.subject, p.body, p.from);
    await addAuditLog({
      actor: "user",
      action: `executed approved Gmail draft for ${p.to}`,
      integration: "gmail",
      riskLevel: "medium",
      result: "completed",
    });
    return { ok: true, result };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Gmail approval execution failed" };
  }
}

export async function executeApproval(approval: ApprovalRequest): Promise<ExecutorResult> {
  switch (approval.integration) {
    case "github":
      return executeGithubApproval(approval.id);
    case "stripe":
      return executeStripe(approval);
    case "shopify":
      return executeShopify(approval);
    case "gmail":
      return executeGmail(approval);
    default:
      return { ok: true }; // nothing to do; manual approval only
  }
}
