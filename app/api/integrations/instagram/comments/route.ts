import { NextResponse } from "next/server";
import { fetchCommentSummary } from "@/lib/integrations/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 12)));
  const summary = await fetchCommentSummary(limit);
  return NextResponse.json({ ok: true, ...summary });
}
