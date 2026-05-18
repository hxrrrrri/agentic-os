import { NextResponse } from "next/server";
import { fetchInstagramStats } from "@/lib/integrations/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const stats = await fetchInstagramStats();
  if (!stats) return NextResponse.json({ ok: false, error: "Instagram not configured or unreachable" }, { status: 503 });
  return NextResponse.json({ ok: true, ...stats });
}
