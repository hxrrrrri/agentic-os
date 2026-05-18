"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export function RunPoller({ runId }: { runId: string }) {
  const router = useRouter();
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/stream`);

    const clearPollTimer = () => {
      if (!pollTimerRef.current) return;
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    };

    const refreshSoon = () => {
      if (refreshTimerRef.current) return;
      refreshTimerRef.current = setTimeout(() => {
        refreshTimerRef.current = null;
        router.refresh();
      }, 0);
    };

    const handleFinal = () => {
      source.close();
      clearPollTimer();
      refreshSoon();
    };

    const handleStatus = (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as { status: string };
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        source.close();
        clearPollTimer();
        refreshSoon();
      }
    };

    const handleDone = () => {
      source.close();
      clearPollTimer();
      refreshSoon();
    };

    const handleError = () => {
      source.close();
      if (!pollTimerRef.current) {
        pollTimerRef.current = setInterval(refreshSoon, 3000);
      }
    };

    source.addEventListener("final", handleFinal);
    source.addEventListener("status", handleStatus);
    source.addEventListener("timeout", handleDone);
    source.addEventListener("error", handleError);

    return () => {
      source.removeEventListener("final", handleFinal);
      source.removeEventListener("status", handleStatus);
      source.removeEventListener("timeout", handleDone);
      source.removeEventListener("error", handleError);
      source.close();
      clearPollTimer();
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, [runId, router]);

  return (
    <div className="flex items-center gap-2 border border-[#2a302c] bg-[#080a09] px-3 py-2 text-xs text-[#8b857b]">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#e86f3a]" />
      Processing - output will appear when complete
    </div>
  );
}
