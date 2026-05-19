"use client";

import { useEffect, useRef, useState } from "react";
import { MarkdownOutput } from "@/components/ui/markdown-output";
import { ArtifactGallery } from "@/components/runs/artifact-gallery";
import type { GeneratedArtifact } from "@/types";

interface RunEvent {
  runId: string;
  type: string;
  at: string;
  payload: Record<string, unknown>;
}

interface LiveOutputProps {
  runId: string;
  initialContent?: string;
  initialArtifacts?: GeneratedArtifact[];
  isProcessing: boolean;
}

function isGeneratedArtifact(value: unknown): value is GeneratedArtifact {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<GeneratedArtifact>;
  return typeof candidate.id === "string"
    && typeof candidate.path === "string"
    && typeof candidate.kind === "string"
    && typeof candidate.format === "string";
}

function mergeArtifacts(current: GeneratedArtifact[], incoming: GeneratedArtifact[]) {
  const byId = new Map(current.map((artifact) => [artifact.id, artifact]));
  for (const artifact of incoming) byId.set(artifact.id, artifact);
  return Array.from(byId.values());
}

export function LiveOutput({ runId, initialContent, initialArtifacts = [], isProcessing }: LiveOutputProps) {
  const [content, setContent] = useState(initialContent ?? "");
  const [artifacts, setArtifacts] = useState<GeneratedArtifact[]>(initialArtifacts);
  const seenRef = useRef(new Set<string>());

  useEffect(() => {
    setArtifacts(initialArtifacts);
  }, [initialArtifacts]);

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
    const handleArtifact = (event: MessageEvent<string>) => {
      try {
        const parsed = JSON.parse(event.data) as RunEvent;
        const payload = parsed.payload;
        const incoming: GeneratedArtifact[] = [];
        if (isGeneratedArtifact(payload.artifact)) incoming.push(payload.artifact);
        if (Array.isArray(payload.artifacts)) {
          for (const artifact of payload.artifacts) {
            if (isGeneratedArtifact(artifact)) incoming.push(artifact);
          }
        }
        if (incoming.length) setArtifacts((prev) => mergeArtifacts(prev, incoming));
      } catch {}
    };
    const handleDone = () => source.close();

    source.addEventListener("run.output", handleOutput);
    source.addEventListener("run.artifact", handleArtifact);
    source.addEventListener("run.completed", handleDone);
    source.addEventListener("run.failed", handleDone);

    return () => source.close();
  }, [isProcessing, runId]);

  // Source of truth precedence:
  //  - run finished (isProcessing=false) and server gave us finalOutput → trust server
  //  - run streaming → use accumulated SSE content
  //  - otherwise placeholder
  // This survives router.refresh() after completion: useState would otherwise
  // pin `content` to its first-mount value ("") even as `initialContent` updates.
  const finished = !isProcessing && initialContent && initialContent.length > 0;
  const visibleContent = finished
    ? (initialContent as string)
    : content || initialContent || (isProcessing ? "Generating output..." : "No output yet.");

  return (
    <div className="min-w-0 max-w-full overflow-hidden border border-[#2a302c] bg-[#080a09] p-4 text-sm">
      {isProcessing && !content && !initialContent ? (
        <div className="mb-3 flex items-center gap-2 text-[0.62rem] uppercase tracking-[0.16em] text-[#6f6a61]">
          <span className="h-2 w-2 animate-pulse rounded-full bg-[#e86f3a]" />
          Live output
        </div>
      ) : null}
      {artifacts.length ? (
        <div className="mb-4">
          <ArtifactGallery artifacts={artifacts} framed={false} />
        </div>
      ) : null}
      <MarkdownOutput content={visibleContent} />
    </div>
  );
}
