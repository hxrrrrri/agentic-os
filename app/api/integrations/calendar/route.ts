import { NextResponse } from "next/server";
import { detectConflicts, listTodayAgenda, listUpcomingEvents } from "@/lib/integrations/calendar";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "upcoming";
  try {
    if (mode === "today") {
      const events = await listTodayAgenda();
      const conflicts = await detectConflicts(events);
      return NextResponse.json({ ok: true, events, conflicts });
    }
    return NextResponse.json({ ok: true, events: await listUpcomingEvents() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Calendar read failed" },
      { status: 500 },
    );
  }
}
