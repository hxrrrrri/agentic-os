import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { MarkdownOutput } from "@/components/ui/markdown-output";
import { RunPoller } from "@/components/runs/run-poller";
import { getRun, getRunPlan } from "@/lib/db/repositories";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RunDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [run, plan] = await Promise.all([getRun(id), getRunPlan(id)]);
  if (!run) notFound();
  const isProcessing = !["completed", "failed", "cancelled"].includes(run.status);

  return (
    <div className="space-y-4">
      {isProcessing && <RunPoller runId={run.id} />}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="terminal-label">Run Detail</div>
          <h1 className="mt-2 max-w-4xl text-2xl font-black tracking-[0.08em]">{run.title}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
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

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Original Prompt</CardTitle></CardHeader>
            <pre className="whitespace-pre-wrap border border-[#2a302c] bg-[#080a09] p-3 text-sm leading-6 text-[#a8a29a]">{run.prompt}</pre>
          </Card>
          <Card>
            <CardHeader><CardTitle>Plan Preview</CardTitle></CardHeader>
            <div className="space-y-2">
              {plan?.steps.map((step, index) => (
                <div key={step.id} className="border border-[#2a302c] bg-[#080a09] p-3">
                  <div className="text-sm text-[#f4f1e8]">{index + 1}. {step.title}</div>
                  <div className="mt-1 text-xs leading-5 text-[#a8a29a]">{step.description}</div>
                  <div className="mt-2 flex gap-2"><Badge>{step.riskLevel}</Badge>{step.requiresApproval && <Badge tone="yellow">approval</Badge>}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Step-by-step Logs</CardTitle></CardHeader>
            <div className="space-y-2">
              {run.steps.map((step) => (
                <div key={step.id} className="border border-[#2a302c] bg-[#080a09] p-3">
                  <div className="flex items-center gap-2 text-sm"><StatusDot status={step.status} />{step.title}</div>
                  <div className="mt-1 text-xs text-[#6f6a61]">{step.observation}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Final Output</CardTitle></CardHeader>
            <div className="border border-[#2a302c] bg-[#080a09] p-4 text-sm">
              <MarkdownOutput content={run.finalOutput ?? "No output yet."} />
            </div>
          </Card>
        </div>
        <aside className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Tool Calls</CardTitle></CardHeader>
            <div className="space-y-2">
              {run.toolCalls.map((call) => (
                <div key={call.id} className="border border-[#2a302c] bg-[#080a09] p-2 text-xs">
                  <div className="flex items-center justify-between gap-2"><span className="text-[#f4f1e8]">{call.tool}</span><Badge>{call.status}</Badge></div>
                  <div className="mt-1 text-[#6f6a61]">{call.action} · {call.riskLevel}</div>
                </div>
              ))}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Files Created</CardTitle></CardHeader>
            <div className="space-y-2">
              {run.createdArtifacts.map((file) => <div key={file} className="border border-[#2a302c] bg-[#080a09] p-2 text-xs text-[#a8a29a]">{file}</div>)}
            </div>
          </Card>
          <Card>
            <CardHeader><CardTitle>Approvals</CardTitle></CardHeader>
            <div className="text-sm text-[#a8a29a]">{run.approvals.length ? `${run.approvals.length} request(s)` : "No approvals required."}</div>
          </Card>
        </aside>
      </div>
    </div>
  );
}
