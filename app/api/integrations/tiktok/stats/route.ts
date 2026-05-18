import { NextResponse } from "next/server";
import { fetchTikTokStats } from "@/lib/integrations/tiktok";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await fetchTikTokStats();
  if (!stats) return NextResponse.json({ ok: false, error: "TikTok not configured or unreachable" }, { status: 503 });
  return NextResponse.json({ ok: true, ...stats });
}
