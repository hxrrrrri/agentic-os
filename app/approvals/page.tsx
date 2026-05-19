import { ApprovalActions } from "@/components/approvals/approval-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listApprovals } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const approvals = await listApprovals();
  const pending = approvals.filter((item) => item.status === "pending").length;

  return (
    <div className="page-enter space-y-3">
      <div>
        <div className="terminal-label">Risk Gate</div>
        <h1 className="mt-1 text-3xl font-black tracking-[0.12em]">APPROVALS</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Pending and Historical Requests</CardTitle>
          <Badge tone={pending > 0 ? "yellow" : "gray"}>{pending} pending</Badge>
        </CardHeader>
        <div className="space-y-2">
          {approvals.map((approval) => {
            const hasPayload =
              approval.commandOrPayload &&
              approval.commandOrPayload !== "{}" &&
              approval.commandOrPayload.trim() !== "";
            return (
              <div key={approval.id} className="grid gap-2 border border-[#2a302c] bg-[#080a09] px-3 py-2 lg:grid-cols-[1fr_auto]">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[0.78rem] font-bold text-[#f4f1e8]">{approval.action}</span>
                    <Badge>{approval.riskLevel}</Badge>
                    <Badge tone={approval.status === "pending" ? "yellow" : approval.status === "approved" ? "green" : "red"}>
                      {approval.status}
                    </Badge>
                    <span className="text-[0.58rem] uppercase tracking-[0.12em] text-[#6f6a61]">
                      {approval.integration} · {approval.affectedResource} · {formatTime(approval.createdAt)}
                    </span>
                  </div>
                  <div className="mt-1 text-[0.7rem] leading-5 text-[#a8a29a]">{approval.explanation}</div>
                  {hasPayload ? (
                    <pre className="mt-1.5 max-h-32 overflow-auto whitespace-pre-wrap border border-[#2a302c] bg-[#0d0f0d] p-1.5 text-[0.62rem] leading-[1.35] text-[#6f6a61]">
                      {approval.commandOrPayload}
                    </pre>
                  ) : null}
                </div>
                {approval.status === "pending" && <ApprovalActions id={approval.id} />}
              </div>
            );
          })}
          {!approvals.length && (
            <div className="border border-[#2a302c] bg-[#080a09] px-3 py-2 text-xs text-[#6f6a61]">
              No approval requests yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
