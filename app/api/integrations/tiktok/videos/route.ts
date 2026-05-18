import { NextResponse } from "next/server";
import { fetchRecentVideos } from "@/lib/integrations/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit") ?? 10)));
  const videos = await fetchRecentVideos(limit);
  return NextResponse.json({ ok: true, videos });
}
