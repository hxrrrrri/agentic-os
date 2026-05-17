import { NextResponse } from "next/server";
import { detectConflicts } from "@/lib/vault/conflict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const conflicts = await detectConflicts();
    return NextResponse.json({ conflicts, total: conflicts.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Detection failed" },
      { status: 500 },
    );
  }
}
