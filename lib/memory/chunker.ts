/**
 * Markdown chunker for fine-grained semantic search.
 *
 * Splits a note into ~1k-char chunks at paragraph/heading boundaries, then
 * embeds each chunk via the existing embeddings provider. Chunks live in
 * `vault_chunks` and reuse `memory_embeddings` keyed by chunk id.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { storeEmbedding, semanticSearch as semanticSearchChunks } from "@/lib/memory/embeddings";
import { createId, nowIso } from "@/lib/utils";

const TARGET_CHARS = 1200;
const MAX_CHARS = 1800;

export function chunkMarkdown(content: string): string[] {
  if (content.length <= TARGET_CHARS) return [content.trim()].filter(Boolean);
  const blocks = content.split(/\n\s*\n/);
  const chunks: string[] = [];
  let buf = "";
  for (const block of blocks) {
    if (!buf) { buf = block; continue; }
    if (buf.length + block.length + 2 <= TARGET_CHARS) {
      buf = `${buf}\n\n${block}`;
    } else if (buf.length >= TARGET_CHARS / 2) {
      chunks.push(buf.trim());
      buf = block;
    } else {
      buf = `${buf}\n\n${block}`;
      if (buf.length >= MAX_CHARS) {
        chunks.push(buf.trim());
        buf = "";
      }
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

interface ChunkRow { id: string; file_path: string; chunk_index: number; content: string; created_at: string }

export async function indexFileChunks(filePath: string, content: string): Promise<{ chunkCount: number }> {
  const db = await getDb();
  db.run(`DELETE FROM vault_chunks WHERE file_path = ?`, [filePath]);
  const pieces = chunkMarkdown(content);
  let i = 0;
  for (const piece of pieces) {
    const id = createId("chk");
    db.run(
      `INSERT INTO vault_chunks (id, file_path, chunk_index, content, created_at) VALUES (?, ?, ?, ?, ?)`,
      [id, filePath, i, piece, nowIso()],
    );
    // Re-use the memory_embeddings store keyed by chunk id (memory_id field doubles as chunk id).
    try { await storeEmbedding(id, piece); } catch { /* best-effort */ }
    i++;
  }
  await saveDb();
  return { chunkCount: pieces.length };
}

export interface ChunkMatch {
  chunkId: string;
  filePath: string;
  chunkIndex: number;
  content: string;
  score: number;
}

export async function semanticSearchChunked(query: string, k = 12): Promise<ChunkMatch[]> {
  const matches = await semanticSearchChunks(query, k * 2);
  if (!matches.length) return [];
  const ids = matches.map((m) => m.memoryId);
  const placeholders = ids.map(() => "?").join(",");
  const db = await getDb();
  const result = db.exec(
    `SELECT id, file_path, chunk_index, content, created_at FROM vault_chunks WHERE id IN (${placeholders})`,
    ids,
  );
  const chunks = rows<ChunkRow>(result);
  const indexed = new Map(chunks.map((c) => [c.id, c]));
  const merged: ChunkMatch[] = matches
    .map((m) => {
      const c = indexed.get(m.memoryId);
      if (!c) return null;
      return {
        chunkId: c.id,
        filePath: c.file_path,
        chunkIndex: c.chunk_index,
        content: c.content,
        score: m.score,
      };
    })
    .filter((x): x is ChunkMatch => x !== null);
  return merged.slice(0, k);
}

/** Quick cross-encoder-style reranker: keyword overlap + position boost on top of cosine. */
export function rerank(query: string, matches: ChunkMatch[]): ChunkMatch[] {
  const queryTerms = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 2));
  if (!queryTerms.size) return matches;
  return [...matches]
    .map((m) => {
      const hay = m.content.toLowerCase();
      let overlap = 0;
      for (const t of queryTerms) if (hay.includes(t)) overlap++;
      const overlapFactor = 1 + overlap / Math.max(1, queryTerms.size);
      const positionFactor = m.chunkIndex === 0 ? 1.1 : 1.0;
      return { ...m, score: m.score * overlapFactor * positionFactor };
    })
    .sort((a, b) => b.score - a.score);
}

export async function relatedToFile(filePath: string, k = 6): Promise<ChunkMatch[]> {
  const db = await getDb();
  const r = db.exec(`SELECT content FROM vault_chunks WHERE file_path = ? ORDER BY chunk_index ASC LIMIT 5`, [filePath]);
  const top = rows<{ content: string }>(r).map((row) => row.content).join("\n\n");
  if (!top) return [];
  const matches = await semanticSearchChunked(top.slice(0, 4000), k * 2);
  return matches.filter((m) => m.filePath !== filePath).slice(0, k);
}
