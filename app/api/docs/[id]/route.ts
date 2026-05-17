import { NextResponse } from "next/server";
import { readDoc } from "@/lib/docs/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const doc = await readDoc(decodeURIComponent(id));
    return NextResponse.json({ ok: true, ...doc });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Read failed" },
      { status: 404 },
    );
  }
}
