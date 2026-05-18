import { NextResponse } from "next/server";
import { z } from "zod";
import { relatedToFile, rerank, semanticSearchChunked } from "@/lib/memory/chunker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Schema = z.union([
  z.object({ query: z.string().min(1).max(2000), k: z.number().int().min(1).max(50).optional() }),
  z.object({ filePath: z.string().min(1).max(400), k: z.number().int().min(1).max(50).optional() }),
]);

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    if ("filePath" in body) {
      const matches = await relatedToFile(body.filePath, body.k ?? 6);
      return NextResponse.json({ ok: true, matches });
    }
    const raw = await semanticSearchChunked(body.query, body.k ?? 12);
    const ranked = rerank(body.query, raw);
    return NextResponse.json({ ok: true, matches: ranked });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
