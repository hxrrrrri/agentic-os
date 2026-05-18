import path from "node:path";
import { createId, nowIso } from "@/lib/utils";
import { upsertMemoryItem } from "@/lib/db/repositories";
import { storeEmbedding } from "@/lib/memory/embeddings";
import type { MemoryItem } from "@/types";

export async function indexGeneratedArtifact(filePath: string, summary: string, tags: string[] = []) {
  const normalized = filePath.replaceAll("\\", "/");
  const folder = normalized.split("/")[0] ?? "runs";
  const type = folder === "daily" ? "daily" : folder === "content" ? "content" : folder === "projects" ? "project" : folder === "wiki" ? "wiki" : folder === "raw" ? "raw" : "run";
  const item: MemoryItem = {
    id: createId("mem"),
    filePath: normalized,
    title: path.basename(normalized, path.extname(normalized)),
    type,
    tags,
    summary,
    lastUpdated: nowIso(),
    embeddingPlaceholder: `mock-embedding:${Buffer.from(normalized).toString("base64").slice(0, 24)}`,
    importanceScore: tags.includes("decision") ? 0.9 : 0.55,
  };
  await upsertMemoryItem(item);
  void storeEmbedding(item.id, `${item.title}\n\n${summary}`).catch(() => {});
  return item;
}

export function searchMemoryInProcess<T extends { title: string; summary: string; tags: string[] }>(items: T[], query: string) {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return items
    .map((item) => ({
      item,
      score: terms.reduce((sum, term) => {
        const haystack = `${item.title} ${item.summary} ${item.tags.join(" ")}`.toLowerCase();
        return sum + (haystack.includes(term) ? 1 : 0);
      }, 0),
    }))
    .filter((scored) => scored.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((scored) => scored.item);
}
