import { NextResponse } from "next/server";
import { z } from "zod";
import { semanticSearch, backfillEmbeddings } from "@/lib/memory/embeddings";
import { listMemoryItems, getMemoryItemsByIds } from "@/lib/db/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({ query: z.string().min(1).max(2000), k: z.number().int().min(1).max(50).optional() });

export async function POST(request: Request) {
  try {
    const body = QuerySchema.parse(await request.json());
    const matches = await semanticSearch(body.query, body.k ?? 8);
    const items = await getMemoryItemsByIds(matches.map((m) => m.memoryId));
    const enriched = items.map((item) => {
      const match = matches.find((m) => m.memoryId === item.id);
      return { ...item, score: match?.score ?? 0, model: match?.model ?? "" };
    });
    enriched.sort((a, b) => b.score - a.score);
    return NextResponse.json({ ok: true, query: body.query, matches: enriched });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}

export async function PUT() {
  // Backfill embeddings for any memory items missing them.
  const items = await listMemoryItems(500);
  const written = await backfillEmbeddings(items);
  return NextResponse.json({ ok: true, written });
}
