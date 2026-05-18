import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import { listVaultFiles } from "@/lib/vault/service";
import { indexFileChunks } from "@/lib/memory/chunker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  try {
    const files = await listVaultFiles();
    let total = 0;
    let chunks = 0;
    for (const f of files.slice(0, 500)) {
      const abs = path.join(agenticosConfig.vaultPath, f.path);
      try {
        const content = await readFile(abs, "utf8");
        const { chunkCount } = await indexFileChunks(f.path, content);
        chunks += chunkCount;
        total++;
      } catch {
        /* skip unreadable */
      }
    }
    return NextResponse.json({ ok: true, files: total, chunks });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Reindex failed" }, { status: 500 });
  }
}
