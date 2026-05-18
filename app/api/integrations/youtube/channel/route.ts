import { NextResponse } from "next/server";
import { fetchYoutubeStats, fetchYoutubeLatest } from "@/lib/integrations/youtube";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, latest] = await Promise.all([fetchYoutubeStats(), fetchYoutubeLatest()]);
  if (!stats) return NextResponse.json({ ok: false, error: "YouTube not configured" }, { status: 503 });
  return NextResponse.json({ ok: true, stats, latest });
}
