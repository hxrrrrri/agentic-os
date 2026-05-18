import { NextResponse } from "next/server";
import { z } from "zod";
import { gdprErase, listComplianceEvents } from "@/lib/compliance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Schema = z.object({ subject: z.string().min(3).max(400), confirm: z.literal(true) });

export async function GET() {
  const events = await listComplianceEvents(100);
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const result = await gdprErase(body.subject);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
