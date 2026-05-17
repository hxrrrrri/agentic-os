import { NextResponse } from "next/server";
import { z } from "zod";
import { listPromotionCandidates, promoteNote } from "@/lib/vault/promote";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const candidates = await listPromotionCandidates();
    return NextResponse.json({ candidates });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}

const PromoteSchema = z.object({ path: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = PromoteSchema.parse(await request.json());
    const result = await promoteNote(body.path);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Promotion failed" },
      { status: 400 },
    );
  }
}
