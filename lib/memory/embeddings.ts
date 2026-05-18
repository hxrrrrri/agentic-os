/**
 * Embeddings module.
 *
 * Provider order:
 *   1. NVIDIA NIM   (nvidia/nv-embedqa-1b-v2)         when NVIDIA_API_KEY is set
 *   2. OpenAI       (text-embedding-3-small)          when OPENAI_API_KEY is set
 *   3. Hash fallback — deterministic 256-dim signed-token bag-of-words
 *
 * Vectors are stored in `memory_embeddings` as base64-packed Float32 BLOBs so
 * the existing sql.js setup doesn't need an extension. Cosine similarity is
 * computed in JS — fine up to ~50k items, swap to sqlite-vec when bigger.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { getSecret } from "@/lib/secrets/store";
import { createId, nowIso } from "@/lib/utils";

const NVIDIA_EMBED_URL = "https://integrate.api.nvidia.com/v1/embeddings";
const OPENAI_EMBED_URL = "https://api.openai.com/v1/embeddings";

export interface EmbeddingResult {
  vector: Float32Array;
  model: string;
}

interface EmbeddingRow {
  id: string;
  memory_id: string;
  model: string;
  dim: number;
  vector_b64: string;
}

function vectorToBase64(vec: Float32Array): string {
  return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength).toString("base64");
}

function base64ToVector(b64: string): Float32Array {
  const buf = Buffer.from(b64, "base64");
  return new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
}

function normalize(vec: Float32Array): Float32Array {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1;
  const out = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

function cosine(a: Float32Array, b: Float32Array): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  for (let i = 0; i < len; i++) dot += a[i] * b[i];
  return dot; // both normalized
}

function hashEmbed(text: string, dim = 256): Float32Array {
  const vec = new Float32Array(dim);
  const tokens = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  for (const tok of tokens) {
    let h = 2166136261;
    for (let i = 0; i < tok.length; i++) {
      h ^= tok.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    const idx = h % dim;
    const sign = ((h >>> 31) & 1) === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  return normalize(vec);
}

async function embedRemote(text: string, url: string, model: string, apiKey: string, payloadExtras: Record<string, unknown> = {}): Promise<Float32Array> {
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ input: text, model, ...payloadExtras }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Embedding API returned ${res.status}`);
  const json = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
  const arr = json.data?.[0]?.embedding;
  if (!arr) throw new Error("Embedding response had no vector");
  return normalize(Float32Array.from(arr));
}

export async function embed(text: string): Promise<EmbeddingResult> {
  const nvidia = await getSecret("NVIDIA_API_KEY");
  if (nvidia) {
    try {
      const vector = await embedRemote(text, NVIDIA_EMBED_URL, "nvidia/nv-embedqa-e5-v5", nvidia, {
        input_type: "passage",
      });
      return { vector, model: "nvidia/nv-embedqa-e5-v5" };
    } catch {
      // fall through
    }
  }
  const openai = await getSecret("OPENAI_API_KEY");
  if (openai) {
    try {
      const vector = await embedRemote(text, OPENAI_EMBED_URL, "text-embedding-3-small", openai);
      return { vector, model: "text-embedding-3-small" };
    } catch {
      // fall through
    }
  }
  return { vector: hashEmbed(text), model: "hash-256" };
}

export async function storeEmbedding(memoryId: string, text: string): Promise<void> {
  const { vector, model } = await embed(text);
  const db = await getDb();
  db.run(`DELETE FROM memory_embeddings WHERE memory_id = ?`, [memoryId]);
  db.run(
    `INSERT INTO memory_embeddings (id, memory_id, model, dim, vector_b64, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [createId("emb"), memoryId, model, vector.length, vectorToBase64(vector), nowIso()],
  );
  await saveDb();
}

export interface VectorMatch {
  memoryId: string;
  score: number;
  model: string;
}

export async function semanticSearch(query: string, k = 8): Promise<VectorMatch[]> {
  const { vector, model } = await embed(query);
  const db = await getDb();
  const result = db.exec(`SELECT id, memory_id, model, dim, vector_b64 FROM memory_embeddings`);
  const all = rows<EmbeddingRow>(result);
  if (all.length === 0) return [];
  const scored: VectorMatch[] = [];
  for (const row of all) {
    if (row.model !== model && (row.model.startsWith("hash") || model.startsWith("hash"))) continue;
    const vec = base64ToVector(row.vector_b64);
    if (vec.length !== vector.length) continue;
    scored.push({ memoryId: row.memory_id, score: cosine(vector, vec), model: row.model });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k);
}

export async function backfillEmbeddings(items: Array<{ id: string; title: string; summary: string }>, limit = 200): Promise<number> {
  let written = 0;
  for (const item of items.slice(0, limit)) {
    try {
      await storeEmbedding(item.id, `${item.title}\n\n${item.summary}`);
      written++;
    } catch {
      // best-effort
    }
  }
  return written;
}
