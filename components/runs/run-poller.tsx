"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function RunPoller({ runId }: { runId: string }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(`/api/runs/${runId}/stream`);

    source.addEventListener("final", () => {
      source.close();
      router.refresh();
    });

    source.addEventListener("status", (event: MessageEvent) => {
      const data = JSON.parse(event.data as string) as { status: string };
      if (["completed", "failed", "cancelled"].includes(data.status)) {
        source.close();
        router.refresh();
      }
    });

    const handleDone = () => {
      source.close();
      router.refresh();
    };

    source.addEventListener("timeout", handleDone);

    source.addEventListener("error", () => {
      source.close();
      // SSE connection dropped — fall back to polling
      const timer = setInterval(() => router.refresh(), 3000);
      return () => clearInterval(timer);
    });

    return () => source.close();
  }, [runId, router]);

  return (
    <div className="flex items-center gap-2 border border-[#2a302c] bg-[#080a09] px-3 py-2 text-xs text-[#8b857b]">
      <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#e86f3a]" />
      Processing — output will appear when complete
    </div>
  );
}
