import { NextResponse } from "next/server";
import { detectPatterns } from "@/lib/vault/patterns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const windowDays = Math.min(90, Number(searchParams.get("days") ?? "30"));
  const minFreq = Math.max(0.1, Math.min(1, Number(searchParams.get("minFreq") ?? "0.25")));
  try {
    const patterns = await detectPatterns(windowDays, minFreq);
    return NextResponse.json({ patterns, windowDays });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Pattern detection failed" },
      { status: 500 },
    );
  }
}
