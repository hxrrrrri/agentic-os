"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, AlertTriangle, CheckCircle2, Hammer, Sparkle } from "lucide-react";

interface RunSummary {
  id: string;
  title: string;
  status: string;
  startedAt: string;
  endedAt?: string;
  costEstimate: number;
}

interface RunEvent {
  runId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  "run.started": Sparkle,
  "run.step": Activity,
  "run.tool": Hammer,
  "run.approval": AlertTriangle,
  "run.artifact": CheckCircle2,
  "run.completed": CheckCircle2,
  "run.failed": AlertTriangle,
  "run.status": Activity,
  "run.log": Activity,
  "run.output": Sparkle,
};

const TONES: Record<string, "green" | "yellow" | "orange" | "red" | "gray"> = {
  "run.started": "orange",
  "run.step": "gray",
  "run.tool": "yellow",
  "run.approval": "red",
  "run.artifact": "green",
  "run.completed": "green",
  "run.failed": "red",
  "run.status": "gray",
  "run.log": "gray",
  "run.output": "orange",
};

function EventStream({ runId }: { runId: string }) {
  const [events, setEvents] = useState<RunEvent[]>([]);
  const eventsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource(`/api/runs/${runId}/events`);
    const handler = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data) as RunEvent;
        setEvents((prev) => [...prev, event]);
      } catch {}
    };
    for (const type of Object.keys(ICONS)) es.addEventListener(type, handler);
    return () => {
      es.close();
    };
  }, [runId]);

  useEffect(() => {
    if (eventsRef.current) eventsRef.current.scrollTop = eventsRef.current.scrollHeight;
  }, [events.length]);

  return (
    <div
      ref={eventsRef}
      className="mt-4 max-h-[60vh] overflow-y-auto rounded-[2px] border border-[#2a302c] bg-[#0b0d0a] p-3 thin-scrollbar"
    >
      {events.length === 0 ? (
        <p className="text-[0.72rem] text-[#6f6a61]">Waiting for events…</p>
      ) : (
        <ul className="space-y-2">
          {events.map((event, i) => {
            const Icon = ICONS[event.type] ?? Activity;
            const tone = TONES[event.type] ?? "gray";
            return (
              <li key={`${event.at}-${i}`} className="flex items-start gap-2 text-[0.72rem]">
                <Badge tone={tone} className="mt-[2px]">
                  {event.type}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-[0.6rem] uppercase tracking-[0.18em] text-[#6f6a61]">
                    <Icon size={9} />
                    {new Date(event.at).toLocaleTimeString()}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[#f4f1e8]">
                    {Object.entries(event.payload)
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
                      .join("\n")}
                  </pre>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function RunTheater() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  // Load run list once on mount.
  useEffect(() => {
    fetch("/api/runs")
      .then((r) => r.json())
      .then((d: { runs: RunSummary[] }) => {
        setRuns(d.runs);
        if (d.runs[0]) setActiveId(d.runs[0].id);
      })
      .catch(() => {});
  }, []);

  const activeRun = useMemo(() => runs.find((r) => r.id === activeId), [runs, activeId]);

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Observability</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">RUN THEATER</h1>
        <p className="mt-1 text-sm text-[#a8a29a]">
          Live event stream over Server-Sent Events. Replaces the legacy polling endpoint.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <div className="mb-2 text-[0.52rem] uppercase tracking-[0.18em] text-[#6f6a61]">Runs</div>
          <ul className="max-h-[70vh] space-y-1 overflow-y-auto thin-scrollbar">
            {runs.length === 0 ? (
              <li className="px-2 py-3 text-[0.7rem] text-[#6f6a61]">No runs yet — start one from the dashboard.</li>
            ) : (
              runs.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setActiveId(r.id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-[2px] px-2 py-[6px] text-left transition ${
                      r.id === activeId
                        ? "bg-[#1d1612] text-[#e86f3a]"
                        : "text-[#a8a29a] hover:bg-[#10120f] hover:text-[#f4f1e8]"
                    }`}
                  >
                    <span className="truncate text-[0.72rem]">{r.title}</span>
                    <Badge tone={r.status === "completed" ? "green" : r.status === "failed" ? "red" : "yellow"}>
                      {r.status}
                    </Badge>
                  </button>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="p-4">
          {activeRun ? (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[0.7rem] uppercase tracking-[0.16em] text-[#6f6a61]">{activeRun.id}</div>
                  <div className="mt-1 text-lg font-bold text-[#f4f1e8]">{activeRun.title}</div>
                </div>
                <Link
                  href={`/runs/${activeRun.id}`}
                  className="inline-flex h-7 items-center rounded-[2px] border border-[#2a302c] bg-[#10120f] px-3 text-[0.6rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
                >
                  Detail
                </Link>
              </div>

              <EventStream key={activeRun.id} runId={activeRun.id} />
            </>
          ) : (
            <p className="text-sm text-[#6f6a61]">Pick a run from the list to subscribe to its live event stream.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
