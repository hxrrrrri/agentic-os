import Link from "next/link";
import { MiniBarChart } from "@/components/charts/activity-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusDot } from "@/components/ui/status-dot";
import { formatTime } from "@/lib/utils";
import type { Run, VaultFile } from "@/types";

export function DashboardSidebar({
  runs,
  weekly,
  recentFiles,
}: {
  runs: Run[];
  weekly: Array<{ day: string; runs: number }>;
  recentFiles: VaultFile[];
}) {
  return (
    <aside className="space-y-3">
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
          <Link href="/runs" className="text-[0.65rem] uppercase tracking-[0.1em] text-[#e86f3a]">open</Link>
        </CardHeader>
        <div className="space-y-2">
          {runs.slice(0, 5).map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`} className="block border border-[#2a302c] bg-[#080a09] p-2 hover:border-[#e86f3a]">
              <div className="flex items-center gap-2 text-xs text-[#f4f1e8]">
                <StatusDot status={run.status} />
                <span className="truncate">{run.title}</span>
              </div>
              <div className="mt-1 text-[0.65rem] text-[#6f6a61]">{formatTime(run.startedAt)} · {run.status}</div>
            </Link>
          ))}
          {!runs.length && <div className="text-xs text-[#6f6a61]">No runs yet.</div>}
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Last Seven Days</CardTitle>
        </CardHeader>
        <MiniBarChart data={weekly} />
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Forecast · 5H</CardTitle>
          <Badge tone="green">Under cap</Badge>
        </CardHeader>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="border border-[#2a302c] bg-[#080a09] p-2">
            <div className="terminal-label">Burn rate</div>
            <div className="mt-2 text-[#f4f1e8]">12.8k / hr</div>
          </div>
          <div className="border border-[#2a302c] bg-[#080a09] p-2">
            <div className="terminal-label">Projected reset</div>
            <div className="mt-2 text-[#f4f1e8]">03:12</div>
          </div>
        </div>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Vault Pulse</CardTitle>
          <Link href="/vault" className="text-[0.65rem] uppercase tracking-[0.1em] text-[#e86f3a]">view</Link>
        </CardHeader>
        <div className="space-y-2">
          {recentFiles.slice(0, 6).map((file) => (
            <div key={file.path} className="border border-[#2a302c] bg-[#080a09] p-2">
              <div className="truncate text-xs text-[#f4f1e8]">{file.path}</div>
              <div className="mt-1 flex items-center justify-between gap-2 text-[0.65rem] text-[#6f6a61]">
                <span>{formatTime(file.updatedAt)}</span>
                <Badge>{file.status}</Badge>
              </div>
            </div>
          ))}
          {!recentFiles.length && <div className="text-xs text-[#6f6a61]">Vault initialized. No files yet.</div>}
        </div>
      </Card>
    </aside>
  );
}
