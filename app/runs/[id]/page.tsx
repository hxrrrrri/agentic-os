import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { RunPoller } from "@/components/runs/run-poller";
import { LiveOutput } from "@/components/runs/live-output";
import { ArtifactGallery } from "@/components/runs/artifact-gallery";
import { getRun, getRunPlan } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run, plan] = await Promise.all([getRun(id), getRunPlan(id)]);
  if (!run) notFound();
  const isProcessing = !["completed", "failed", "cancelled"].includes(run.status);

  return (
    <div className="page-enter space-y-3">
      {isProcessing && <RunPoller runId={run.id} />}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="terminal-label">Run Detail</div>
          <h1 className="mt-1 max-w-4xl text-2xl font-black tracking-[0.08em]">{run.title}</h1>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge><StatusDot status={run.status} className="mr-2" />{run.status}</Badge>
            <Badge tone="orange">{run.category}</Badge>
            <Badge>{formatTime(run.startedAt)}</Badge>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/dashboard?skill=${run.selectedSkill ?? ""}`}><Button>Retry</Button></Link>
          <Link href={`/api/runs/${run.id}`}><Button>Export JSON</Button></Link>
        </div>
      </div>

      <div className="grid min-w-0 max-w-full gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 max-w-full space-y-3">
          <Card>
            <CardHeader><CardTitle>Original Prompt</CardTitle></CardHeader>
            <pre className="safe-wrap max-w-full whitespace-pre-wrap border border-[#2a302c] bg-[#080a09] p-2 text-[0.78rem] leading-5 text-[#a8a29a]">{run.prompt}</pre>
          </Card>
          {run.artifacts?.length ? (
            <ArtifactGallery artifacts={run.artifacts} framed />
          ) : null}
          {plan?.steps.length ? (
            <Card>
              <CardHeader><CardTitle>Plan Preview</CardTitle><Badge>{plan.steps.length}</Badge></CardHeader>
              {plan.routing ? (
                <div className="border border-[#2a302c] border-b-0 bg-[#0d100e] px-2.5 py-1.5 text-[0.66rem] text-[#a8a29a]">
                  <span className="mr-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#e86f3a]">auto-router</span>
                  {plan.routing.skillId ? `→ ${plan.routing.skillId}` : "no skill"}
                  <span className="ml-2 text-[#6f6a61]">conf {(plan.routing.confidence * 100).toFixed(0)}%</span>
                  <span className="ml-2 text-[#6f6a61]">· {plan.routing.reason}</span>
                  {plan.routing.tokensUsed ? <span className="ml-2 text-[#6f6a61]">· {plan.routing.tokensUsed} tok</span> : null}
                </div>
              ) : null}
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {plan.steps.map((step, index) => (
                  <div key={step.id} className="px-2.5 py-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[0.78rem] text-[#f4f1e8]">{index + 1}. {step.title}</span>
                      <Badge>{step.riskLevel}</Badge>
                      {step.requiresApproval ? <Badge tone="yellow">approval</Badge> : null}
                    </div>
                    <div className="text-[0.66rem] leading-[1.4] text-[#a8a29a]">{step.description}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {run.steps.length ? (
            <Card>
              <CardHeader><CardTitle>Step-by-step Logs</CardTitle><Badge>{run.steps.length}</Badge></CardHeader>
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {run.steps.map((step) => (
                  <div key={step.id} className="px-2.5 py-1.5">
                    <div className="flex items-center gap-2 text-[0.78rem]"><StatusDot status={step.status} />{step.title}</div>
                    {step.observation ? (
                      <div className="mt-0.5 truncate text-[0.66rem] text-[#6f6a61]">{step.observation}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader><CardTitle>Final Output</CardTitle></CardHeader>
            <LiveOutput
              runId={run.id}
              initialContent={run.finalOutput}
              initialArtifacts={run.artifacts ?? []}
              isProcessing={isProcessing}
            />
          </Card>
          {run.status === "failed" && run.errorDetail ? (
            <Card>
              <CardHeader><CardTitle>Error Detail</CardTitle></CardHeader>
              <pre className="safe-wrap max-w-full max-h-96 overflow-auto whitespace-pre-wrap border border-[#5a2424] bg-[#100808] p-2 text-[0.7rem] leading-5 text-[#e0a8a8]">
                {run.errorDetail}
              </pre>
            </Card>
          ) : null}
        </div>
        <aside className="min-w-0 max-w-full space-y-3">
          {run.toolCalls.length ? (
            <Card>
              <CardHeader><CardTitle>Tool Calls</CardTitle><Badge>{run.toolCalls.length}</Badge></CardHeader>
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {run.toolCalls.map((call) => (
                  <div key={call.id} className="px-2 py-1 text-[0.68rem]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-[#f4f1e8]">{call.tool}</span>
                      <Badge>{call.status}</Badge>
                    </div>
                    <div className="truncate text-[0.6rem] text-[#6f6a61]">{call.action} · {call.riskLevel}</div>
                  </div>
                ))}
              </div>
            </Card>
          ) : null}
          {run.createdArtifacts.length ? (
            <Card>
              <CardHeader><CardTitle>Files Created</CardTitle><Badge>{run.createdArtifacts.length}</Badge></CardHeader>
              <div className="divide-y divide-[#1d231f] border border-[#2a302c] bg-[#080a09]">
                {run.createdArtifacts.map((file) => (
                  <div key={file} className="truncate px-2 py-1 text-[0.66rem] text-[#a8a29a]">{file}</div>
                ))}
              </div>
            </Card>
          ) : null}
          {run.approvals.length ? (
            <Card>
              <CardHeader><CardTitle>Approvals</CardTitle><Badge tone="yellow">{run.approvals.length}</Badge></CardHeader>
              <div className="text-[0.7rem] text-[#a8a29a]">
                {run.approvals.length} request(s) — see <Link href="/approvals" className="text-[#e86f3a] hover:underline">Approvals</Link>.
              </div>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
