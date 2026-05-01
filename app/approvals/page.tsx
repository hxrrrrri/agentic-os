import { ApprovalActions } from "@/components/approvals/approval-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listApprovals } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Risk Gate</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">APPROVALS</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Pending and Historical Requests</CardTitle><Badge tone="yellow">{approvals.filter((item) => item.status === "pending").length} pending</Badge></CardHeader>
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="grid gap-3 border border-[#2a302c] bg-[#080a09] p-3 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap gap-2"><span className="text-sm font-bold text-[#f4f1e8]">{approval.action}</span><Badge>{approval.riskLevel}</Badge><Badge>{approval.status}</Badge></div>
                <div className="mt-2 text-xs leading-5 text-[#a8a29a]">{approval.explanation}</div>
                <div className="mt-2 text-xs text-[#6f6a61]">Integration: {approval.integration} · resource: {approval.affectedResource} · {formatTime(approval.createdAt)}</div>
                <pre className="mt-2 whitespace-pre-wrap border border-[#2a302c] p-2 text-[0.68rem] text-[#6f6a61]">{approval.commandOrPayload}</pre>
              </div>
              {approval.status === "pending" && <ApprovalActions id={approval.id} />}
            </div>
          ))}
          {!approvals.length && <div className="p-4 text-sm text-[#6f6a61]">No approval requests yet.</div>}
        </div>
      </Card>
    </div>
  );
}
