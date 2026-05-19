import { NextResponse } from "next/server";
import { listProviderModels } from "@/lib/agent/provider-api";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const result = await listProviderModels(provider);
  return NextResponse.json(result.body, { status: result.status });
}
