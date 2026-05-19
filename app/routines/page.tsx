import { RoutineActions } from "@/components/routines/routine-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoutineOverview } from "@/lib/scheduler/routines";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const { routines, enabledCount } = await getRoutineOverview();
  return (
    <div className="page-enter space-y-3">
      <div>
        <div className="terminal-label">Automation Layer</div>
        <h1 className="mt-1 text-3xl font-black tracking-[0.12em]">ROUTINES</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Routine Schedule</CardTitle><Badge tone="orange">{enabledCount} enabled</Badge></CardHeader>
        <div className="space-y-2">
          {routines.map((routine) => (
            <div key={routine.id} className="grid items-center gap-3 border border-[#2a302c] bg-[#080a09] px-3 py-2 lg:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[0.78rem] font-bold text-[#f4f1e8]">{routine.name}</span>
                  <Badge tone={routine.enabled ? "green" : "gray"}>{routine.enabled ? "enabled" : "disabled"}</Badge>
                  <Badge>{routine.approvalMode}</Badge>
                  <span className="text-[0.58rem] uppercase tracking-[0.12em] text-[#6f6a61]">
                    {routine.schedule} · next {routine.nextRun ?? "unset"} · last {formatTime(routine.lastRun) || "never"}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-[0.7rem] text-[#a8a29a]">{routine.description}</div>
              </div>
              <RoutineActions id={routine.id} enabled={routine.enabled} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
