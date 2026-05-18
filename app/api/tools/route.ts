import { NextResponse } from "next/server";
import { listToolSchemas, listToolSchemasOpenAI } from "@/lib/agent/tool-gateway";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") ?? "raw";
  if (format === "openai") return NextResponse.json({ tools: listToolSchemasOpenAI() });
  return NextResponse.json({ tools: listToolSchemas() });
}
