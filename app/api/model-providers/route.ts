import { NextResponse } from "next/server";
import { listProviderModels, testProviderConnection } from "@/lib/agent/provider-api";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const provider = searchParams.get("provider") ?? "";
  const action = searchParams.get("action") ?? "models";

  if (action !== "models") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const result = await listProviderModels(provider);
  return NextResponse.json(result.body, { status: result.status });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as { provider?: string; action?: string };
  const action = body.action ?? "test";

  if (action !== "test") {
    return NextResponse.json({ ok: false, message: "Unsupported action" }, { status: 400 });
  }

  const result = await testProviderConnection(body.provider ?? "");
  return NextResponse.json(result.body, { status: result.status });
}
