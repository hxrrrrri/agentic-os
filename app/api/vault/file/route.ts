import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveVaultPath } from "@/lib/vault/service";

export const runtime = "nodejs";

const MIME_BY_EXT: Record<string, string> = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".pdf": "application/pdf",
};

/** Stream a single vault file. Used by artifact-gallery to render SVG/PNG
 *  inline. Path traversal is blocked by resolveVaultPath. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rel = searchParams.get("path") ?? "";
  if (!rel) return NextResponse.json({ error: "path required" }, { status: 400 });

  let absolute: string;
  try {
    absolute = resolveVaultPath(rel);
  } catch {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }

  try {
    const stat = await fs.stat(absolute);
    if (stat.isDirectory()) {
      return NextResponse.json({ error: "is a directory" }, { status: 400 });
    }
    const buffer = await fs.readFile(absolute);
    const ext = path.extname(absolute).toLowerCase();
    const mime = MIME_BY_EXT[ext] ?? "application/octet-stream";
    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
