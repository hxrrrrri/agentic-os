/**
 * Executes GitHub write approvals once they flip to "approved".
 *
 * The approval row stores the action string + commandOrPayload JSON. We parse
 * both to dispatch to the right GitHub helper.
 */

import { getApproval, updateApproval, addAuditLog } from "@/lib/db/repositories";
import { createIssue, postIssueComment } from "@/lib/integrations/github";

interface CommentPayload {
  body?: string;
}

interface CreateIssuePayload {
  title?: string;
  body?: string;
  labels?: string[];
}

function parsePayload<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function executeGithubApproval(approvalId: string): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const approval = await getApproval(approvalId);
  if (!approval) return { ok: false, error: "Approval not found" };
  if (approval.integration !== "github") return { ok: false, error: "Not a GitHub approval" };
  if (approval.status !== "approved") return { ok: false, error: `Approval status is ${approval.status}` };

  try {
    if (approval.action.startsWith("Post comment on ")) {
      const payload = parsePayload<CommentPayload>(approval.commandOrPayload);
      const [repoAndNumber] = approval.action.replace("Post comment on ", "").split(" ");
      const [owner, repo, number] = repoAndNumber.split(/[/#]/);
      const numberInt = parseInt(number, 10);
      if (!owner || !repo || !numberInt || !payload?.body) throw new Error("Malformed comment approval");
      const result = await postIssueComment(`${owner}/${repo}`, numberInt, payload.body);
      await addAuditLog({
        actor: "user",
        action: `executed approved GitHub comment on ${owner}/${repo}#${numberInt}`,
        integration: "github",
        riskLevel: "high",
        result: "completed",
      });
      return { ok: true, result };
    }

    if (approval.action.startsWith("Create issue in ")) {
      const payload = parsePayload<CreateIssuePayload>(approval.commandOrPayload);
      const repo = approval.affectedResource;
      if (!repo || !payload?.title) throw new Error("Malformed create-issue approval");
      const result = await createIssue(repo, payload.title, payload.body, payload.labels);
      await addAuditLog({
        actor: "user",
        action: `executed approved GitHub issue create in ${repo}`,
        integration: "github",
        riskLevel: "high",
        result: "completed",
      });
      return { ok: true, result };
    }

    return { ok: false, error: `Unknown approval action: ${approval.action}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : "GitHub approval execution failed";
    await updateApproval(approval.id, "rejected");
    await addAuditLog({
      actor: "system",
      action: `failed to execute GitHub approval ${approval.id}: ${message}`,
      integration: "github",
      riskLevel: "high",
      result: "failed",
    });
    return { ok: false, error: message };
  }
}
