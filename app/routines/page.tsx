import { RoutineActions } from "@/components/routines/routine-actions";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getRoutineOverview } from "@/lib/scheduler/routines";
import { formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RoutinesPage() {
  const { routines, enabledCount } = await getRoutineOverview();
  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Automation Layer</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">ROUTINES</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Routine Schedule</CardTitle><Badge tone="orange">{enabledCount} enabled</Badge></CardHeader>
        <div className="grid gap-3">
          {routines.map((routine) => (
            <div key={routine.id} className="grid gap-3 border border-[#2a302c] bg-[#080a09] p-3 lg:grid-cols-[1fr_auto]">
              <div>
                <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-bold text-[#f4f1e8]">{routine.name}</span><Badge tone={routine.enabled ? "green" : "gray"}>{routine.enabled ? "enabled" : "disabled"}</Badge><Badge>{routine.approvalMode}</Badge></div>
                <div className="mt-2 text-xs leading-5 text-[#a8a29a]">{routine.description}</div>
                <div className="mt-2 text-[0.65rem] text-[#6f6a61]">{routine.schedule} · last {formatTime(routine.lastRun)} · next {routine.nextRun ?? "unset"}</div>
              </div>
              <RoutineActions id={routine.id} enabled={routine.enabled} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
