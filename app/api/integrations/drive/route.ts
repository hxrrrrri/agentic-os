import { NextResponse } from "next/server";
import { listRecentFiles, searchFiles } from "@/lib/integrations/drive";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  try {
    if (query) return NextResponse.json({ ok: true, files: await searchFiles(query) });
    return NextResponse.json({ ok: true, files: await listRecentFiles() });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Drive read failed" },
      { status: 500 },
    );
  }
}
