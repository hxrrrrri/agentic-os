import { NextResponse } from "next/server";
import { fetchRecentMedia } from "@/lib/integrations/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number(url.searchParams.get("limit") ?? 12)));
  const media = await fetchRecentMedia(limit);
  return NextResponse.json({ ok: true, media });
}
