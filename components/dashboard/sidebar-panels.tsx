import Link from "next/link";
import { MiniBarChart } from "@/components/charts/activity-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
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
      <Card className="p-2.5">
        <CardHeader>
          <CardTitle className="text-[#e86f3a]">Recent Runs</CardTitle>
        </CardHeader>
        <div className="divide-y divide-[#2a302c]">
          {runs.slice(0, 6).map((run) => (
            <Link key={run.id} href={`/runs/${run.id}`} className="grid grid-cols-[42px_1fr_42px] gap-2 py-2 text-[0.62rem] uppercase tracking-[0.08em] hover:text-[#e86f3a]">
              <span className="text-[#8b857b]">{new Date(run.startedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              <span className="truncate font-bold text-[#f4f1e8]">{run.selectedSkill ?? run.title}</span>
              <span className="text-right text-[#8b857b]">open /</span>
            </Link>
          ))}
          {!runs.length && <div className="py-2 text-xs text-[#6f6a61]">No runs yet.</div>}
        </div>
      </Card>

      <Card className="p-2.5">
        <CardHeader>
          <CardTitle>Last <span className="text-[#e86f3a]">Seven</span> Days</CardTitle>
          <div className="text-[0.55rem] uppercase tracking-[0.16em] text-[#8b857b]">+ {runs.length} runs</div>
        </CardHeader>
        <MiniBarChart data={weekly} />
      </Card>

      <Card className="p-2.5">
        <CardHeader>
          <CardTitle>Forecast - 5H</CardTitle>
          <div className="text-right text-[0.52rem] uppercase tracking-[0.16em] text-[#8b857b]">
            burn - 3.1m/min
            <div className="text-[#e86f3a]">this window</div>
          </div>
        </CardHeader>
        <div className="terminal-label mb-1">Under cap</div>
        <div className="h-4 border border-[#7b4633] bg-[repeating-linear-gradient(45deg,#7d3d2b_0,#7d3d2b_3px,#2b2019_3px,#2b2019_7px)]" />
        <div className="mt-3 grid grid-cols-[44px_1fr_auto] gap-2 text-[0.58rem] uppercase tracking-[0.08em]">
          <span className="text-[#e86f3a]">22:00</span>
          <span className="text-[#f4f1e8]">Vault compact</span>
          <span className="text-[#8b857b]">in 1h 51m</span>
          <span className="text-[#e86f3a]">09:00</span>
          <span className="text-[#f4f1e8]">Morning brief</span>
          <span className="text-[#8b857b]">in 12h 51m</span>
        </div>
      </Card>

      <Card className="p-2.5">
        <CardHeader>
          <CardTitle className="text-[#e86f3a]">Vault Pulse</CardTitle>
        </CardHeader>
        <div className="space-y-2">
          {recentFiles.slice(0, 6).map((file) => (
            <div key={file.path} className="grid grid-cols-[64px_1fr] gap-2 text-[0.58rem] uppercase tracking-[0.08em]">
              <Badge tone={file.status === "created" ? "orange" : "gray"}>{file.status}</Badge>
              <div className="min-w-0">
                <div className="truncate font-bold text-[#f4f1e8]">{file.path}</div>
                <div className="truncate text-[#8b857b]">{formatTime(file.updatedAt)}</div>
              </div>
            </div>
          ))}
          {!recentFiles.length && <div className="text-xs text-[#6f6a61]">Vault initialized. No files yet.</div>}
        </div>
      </Card>
    </aside>
  );
}
