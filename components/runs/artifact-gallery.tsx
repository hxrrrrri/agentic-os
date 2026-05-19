"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { GeneratedArtifact } from "@/types";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function vaultUrl(relativePath: string): string {
  return `/api/vault/file?path=${encodeURIComponent(relativePath)}`;
}

function isImage(artifact: GeneratedArtifact): boolean {
  return (
    artifact.format === "svg"
    || artifact.format === "png"
    || artifact.format === "jpg"
    || artifact.mimeType.startsWith("image/")
  );
}

function groupByVariant(artifacts: GeneratedArtifact[]): Array<{ key: string; items: GeneratedArtifact[] }> {
  const groups = new Map<string, GeneratedArtifact[]>();
  for (const a of artifacts) {
    const k = a.variantGroup ?? "default";
    const arr = groups.get(k) ?? [];
    arr.push(a);
    groups.set(k, arr);
  }
  return Array.from(groups.entries()).map(([key, items]) => ({ key, items }));
}

function ArtifactCard({ artifact }: { artifact: GeneratedArtifact }) {
  const [open, setOpen] = useState(false);
  const url = vaultUrl(artifact.path);
  const previewAspect = artifact.width && artifact.height
    ? `${artifact.width} / ${artifact.height}`
    : "1 / 1";
  if (isImage(artifact)) {
    return (
      <figure className="overflow-hidden border border-[#2a302c] bg-[#080a09]">
        <div className="bg-black/40" style={{ aspectRatio: previewAspect }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={artifact.title}
            className="h-full w-full object-contain"
            loading="lazy"
          />
        </div>
        <figcaption className="space-y-1 border-t border-[#1d231f] px-2 py-1.5 text-[0.66rem]">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate text-[#f4f1e8]">{artifact.title}</span>
            <Badge>{artifact.format}</Badge>
          </div>
          {artifact.caption ? (
            <div className="line-clamp-2 text-[0.6rem] text-[#6f6a61]">{artifact.caption}</div>
          ) : null}
          <div className="flex items-center justify-between text-[0.6rem] text-[#6f6a61]">
            <span className="truncate">{artifact.path}</span>
            <Link href={url} target="_blank" rel="noreferrer" className="text-[#e86f3a] hover:underline">
              open
            </Link>
          </div>
        </figcaption>
      </figure>
    );
  }
  if (artifact.format === "html") {
    return (
      <div className="overflow-hidden border border-[#2a302c] bg-[#080a09]">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between border-b border-[#1d231f] px-2 py-1.5 text-left text-[0.7rem] text-[#f4f1e8] hover:bg-[#11140f]"
        >
          <span className="truncate">{artifact.title}</span>
          <Badge>{open ? "hide" : "preview"}</Badge>
        </button>
        {open ? (
          <iframe
            src={url}
            title={artifact.title}
            className="h-[480px] w-full border-0"
            sandbox="allow-same-origin"
          />
        ) : (
          <div className="px-2 py-1.5 text-[0.6rem] text-[#6f6a61]">{artifact.path}</div>
        )}
      </div>
    );
  }
  return (
    <div className="border border-[#2a302c] bg-[#080a09] px-2 py-1.5 text-[0.7rem]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[#f4f1e8]">{artifact.title}</span>
        <Badge>{artifact.format}</Badge>
      </div>
      <div className="flex items-center justify-between text-[0.6rem] text-[#6f6a61]">
        <span className="truncate">{artifact.path}</span>
        <Link href={url} target="_blank" rel="noreferrer" className="text-[#e86f3a] hover:underline">
          open
        </Link>
      </div>
    </div>
  );
}

function GalleryBody({ artifacts }: { artifacts: GeneratedArtifact[] }) {
  const groups = useMemo(() => groupByVariant(artifacts), [artifacts]);
  return (
    <div className="space-y-3 p-2">
      {groups.map((g) => (
        <div key={g.key} className="space-y-1.5">
          {g.key !== "default" ? (
            <div className="terminal-label text-[0.6rem]">variant: {g.key}</div>
          ) : null}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.items.map((a) => (
              <ArtifactCard key={a.id} artifact={a} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ArtifactGallery({ artifacts, framed = true }: { artifacts: GeneratedArtifact[]; framed?: boolean }) {
  if (!artifacts.length) return null;
  const header = (
    <CardHeader>
      <CardTitle>Visual Artifacts</CardTitle>
      <Badge>{artifacts.length}</Badge>
    </CardHeader>
  );
  if (!framed) {
    return (
      <div className="space-y-1">
        {header}
        <GalleryBody artifacts={artifacts} />
      </div>
    );
  }
  return (
    <Card>
      {header}
      <GalleryBody artifacts={artifacts} />
    </Card>
  );
}
