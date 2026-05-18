/**
 * Prompt-response cache. Identical (provider, model, prompt) tuples short-
 * circuit the model call and return the stored response. Cache is keyed by
 * SHA-256 of `provider|model|prompt`. Entries are pinned to the user — the DB
 * is local — so this never leaves the host.
 */

import { createHash } from "node:crypto";
import { getDb, saveDb, rows } from "@/lib/db/client";
import { nowIso } from "@/lib/utils";

export interface CacheEntry {
  hash: string;
  provider?: string;
  model?: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  hits: number;
  createdAt: string;
  lastHitAt?: string;
}

interface CacheRow {
  hash: string;
  provider: string | null;
  model: string | null;
  response: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  hits: number;
  created_at: string;
  last_hit_at: string | null;
}

export function hashKey(provider: string, model: string, prompt: string, extra?: string): string {
  return createHash("sha256")
    .update(`${provider}|${model}|${prompt}`)
    .update(extra ? `|${extra}` : "")
    .digest("hex");
}

export async function getCached(hash: string): Promise<CacheEntry | null> {
  const db = await getDb();
  const result = db.exec(
    `SELECT hash, provider, model, response, input_tokens, output_tokens, cost_usd, hits, created_at, last_hit_at
     FROM prompt_cache WHERE hash = ?`,
    [hash],
  );
  const row = rows<CacheRow>(result)[0];
  if (!row) return null;
  return {
    hash: row.hash,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    response: row.response,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    costUsd: row.cost_usd,
    hits: row.hits,
    createdAt: row.created_at,
    lastHitAt: row.last_hit_at ?? undefined,
  };
}

export async function recordCacheHit(hash: string): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE prompt_cache SET hits = hits + 1, last_hit_at = ? WHERE hash = ?`, [nowIso(), hash]);
  await saveDb();
}

export async function putCached(
  hash: string,
  data: { provider: string; model: string; response: string; inputTokens: number; outputTokens: number; costUsd: number },
): Promise<void> {
  const db = await getDb();
  const now = nowIso();
  db.run(
    `INSERT INTO prompt_cache (hash, provider, model, response, input_tokens, output_tokens, cost_usd, hits, created_at, last_hit_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, NULL)
     ON CONFLICT(hash) DO UPDATE SET response = excluded.response, input_tokens = excluded.input_tokens, output_tokens = excluded.output_tokens, cost_usd = excluded.cost_usd`,
    [hash, data.provider, data.model, data.response, data.inputTokens, data.outputTokens, data.costUsd, now],
  );
  await saveDb();
}

export async function cacheStats(): Promise<{ entries: number; hits: number; estSaved: number }> {
  const db = await getDb();
  const result = db.exec(`SELECT COUNT(*) AS entries, SUM(hits) AS hits, SUM(cost_usd * hits) AS saved FROM prompt_cache`);
  const r = result[0]?.values[0];
  return {
    entries: Number(r?.[0] ?? 0),
    hits: Number(r?.[1] ?? 0),
    estSaved: Number(r?.[2] ?? 0),
  };
}

export async function clearCache(): Promise<number> {
  const db = await getDb();
  const before = (await cacheStats()).entries;
  db.run(`DELETE FROM prompt_cache`);
  await saveDb();
  return before;
}
