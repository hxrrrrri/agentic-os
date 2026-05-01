import { listRoutines, toggleRoutine } from "@/lib/db/repositories";

export async function getRoutineOverview() {
  const routines = await listRoutines();
  return {
    routines,
    enabledCount: routines.filter((routine) => routine.enabled).length,
    dueSoon: routines.filter((routine) => routine.enabled).slice(0, 3),
  };
}

export async function setRoutineEnabled(id: string, enabled: boolean) {
  await toggleRoutine(id, enabled);
}
