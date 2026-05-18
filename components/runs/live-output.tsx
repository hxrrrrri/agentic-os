"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownOutput } from "@/components/ui/markdown-output";

interface RunEvent {
  runId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

interface LiveOutputProps {
  runId: string;
  initialContent?: string;
  isProcessing: boolean;
}

export function LiveOutput({ runId, initialContent, isProcessing }: LiveOutputProps) {
  const [content, setContent] = useState(initialContent ?? "");
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    if (!isProcessing) return;

    const source = new EventSource(`/api/runs/${runId}/events`);
    const handleOutput = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as RunEvent;
        const delta = typeof parsed.payload.delta === "string" ? parsed.payload.delta : "";
        if (!delta) return;
        const key = `${parsed.at}:${delta.length}:${delta.slice(0, 24)}`;
        if (seenRef.current.has(key)) return;
        seenRef.current.add(key);
        setContent((prev) => `${prev}${delta}`);
      } catch {}
    };
    const handleDone = () => source.close();

    source.addEventListener("run.output", handleOutput);
    source.addEventListener("run.completed", handleDone);
    source.addEventListener("run.failed", handleDone);

    return () => source.close();
  }, [isProcessing, runId]);

  const visibleContent = content || (isProcessing ? "Generating output..." : "No output yet.");

  return (
    <div className="min-w-0 max-w-full overflow-hidden border border-[#2a302c] bg-[#080a09] p-4 text-sm">
      {isProcessing && !initialContent ? (
        <div className="mb-3 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-[#6f6a61]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#e86f3a]" />
          Live output
        </div>
      ) : null}
      <MarkdownOutput content={visibleContent} />
    </div>
  );
}
