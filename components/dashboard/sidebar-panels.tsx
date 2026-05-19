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
    <aside className="space-y-2">
      <Card className="card-lift px-2.5 py-2">
        <CardHeader>
          <CardTitle className="text-[#e86f3a]">Recent Runs</CardTitle>
          {runs.length ? <Badge>{runs.length}</Badge> : null}
        </CardHeader>
        <div className="divide-y divide-[#2a302c]">
          {runs.slice(0, 6).map((run) => (
            <Link
              key={run.id}
              href={`/runs/${run.id}`}
              className="grid grid-cols-[52px_1fr_28px] items-center gap-2 py-1.5 text-[0.72rem] uppercase tracking-[0.08em] transition hover:text-[#e86f3a]"
            >
              <span className="text-[#8b857b]">{new Date(run.startedAt).toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit", hour12: false })}</span>
              <span className="truncate font-bold text-[#f4f1e8]">{run.selectedSkill ?? run.title}</span>
              <span className="text-right text-[#8b857b]">→</span>
            </Link>
          ))}
          {!runs.length && <div className="py-1.5 text-xs text-[#6f6a61]">No runs yet.</div>}
        </div>
      </Card>

      <Card className="card-lift px-2.5 py-2">
        <CardHeader>
          <CardTitle>Last <span className="text-[#e86f3a]">Seven</span> Days</CardTitle>
          <div className="text-[0.55rem] uppercase tracking-[0.16em] text-[#8b857b]">+ {runs.length} runs</div>
        </CardHeader>
        <MiniBarChart data={weekly} />
      </Card>

      {recentFiles.length ? (
        <Card className="card-lift px-2.5 py-2">
          <CardHeader>
            <CardTitle className="text-[#e86f3a]">Vault Pulse</CardTitle>
            <Badge>{recentFiles.length}</Badge>
          </CardHeader>
          <div className="divide-y divide-[#1d231f]">
            {recentFiles.slice(0, 6).map((file) => (
              <div
                key={file.path}
                className="grid grid-cols-[62px_1fr] items-center gap-2 py-1.5 text-[0.68rem] uppercase tracking-[0.08em]"
              >
                <Badge tone={file.status === "created" ? "orange" : "gray"}>{file.status}</Badge>
                <div className="min-w-0">
                  <div className="truncate font-bold text-[#f4f1e8]">{file.path}</div>
                  <div className="truncate text-[#8b857b]">{formatTime(file.updatedAt)}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}
    </aside>
  );
}
