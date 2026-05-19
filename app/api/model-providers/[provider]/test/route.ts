import { NextResponse } from "next/server";
import { testProviderConnection } from "@/lib/agent/provider-api";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;
  const result = await testProviderConnection(provider);
  return NextResponse.json(result.body, { status: result.status });
}
