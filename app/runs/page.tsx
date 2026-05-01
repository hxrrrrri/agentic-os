import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatMs, formatTime } from "@/lib/utils";
import { listRuns } from "@/lib/db/repositories";

export const dynamic = "force-dynamic";

export default async function RunsPage() {
  const runs = await listRuns();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Run Ledger</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">RUNS</h1>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>All Previous Runs</CardTitle>
          <div className="text-xs text-[#6f6a61]">Filter-ready ledger by status, category, and skill</div>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-[#2a302c] text-[#6f6a61]">
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Run</th>
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Status</th>
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Category</th>
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Started</th>
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Duration</th>
                <th className="p-3 font-normal uppercase tracking-[0.1em]">Tokens</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.id} className="border-b border-[#1d231f] hover:bg-[#141815]">
                  <td className="p-3">
                    <Link href={`/runs/${run.id}`} className="text-[#f4f1e8] hover:text-[#e86f3a]">{run.title}</Link>
                    <div className="mt-1 text-[#6f6a61]">{run.selectedSkill ?? "router"}</div>
                  </td>
                  <td className="p-3"><Badge><StatusDot status={run.status} className="mr-2" />{run.status}</Badge></td>
                  <td className="p-3 text-[#a8a29a]">{run.category}</td>
                  <td className="p-3 text-[#a8a29a]">{formatTime(run.startedAt)}</td>
                  <td className="p-3 text-[#a8a29a]">{formatMs(run.durationMs)}</td>
                  <td className="p-3 text-[#a8a29a]">{run.tokensEstimate.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!runs.length && <div className="p-6 text-sm text-[#6f6a61]">No runs yet. Start one from the dashboard prompt console.</div>}
        </div>
      </Card>
    </div>
  );
}
