import { NextResponse } from "next/server";
import { createVaultSnapshot, listSnapshots } from "@/lib/compliance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const snapshots = await listSnapshots();
  return NextResponse.json({ snapshots });
}

export async function POST() {
  try {
    const result = await createVaultSnapshot();
    return NextResponse.json({ ok: true, snapshot: result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Snapshot failed" }, { status: 500 });
  }
}
