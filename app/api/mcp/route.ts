import { NextResponse } from "next/server";
import { z } from "zod";
import { connectMcpServer, disconnectMcp, listConnectedServers, listMcpTools } from "@/lib/mcp/bridge";

export const runtime = "nodejs";

const ConnectSchema = z.object({
  id: z.string().min(1),
  command: z.string().min(1),
  args: z.array(z.string()).optional(),
  env: z.record(z.string(), z.string()).optional(),
});

export async function GET() {
  const servers = listConnectedServers();
  const tools = await Promise.all(
    servers.map(async (id) => ({ id, tools: await listMcpTools(id).catch(() => []) })),
  );
  return NextResponse.json({ servers, tools });
}

export async function POST(request: Request) {
  const body = ConnectSchema.parse(await request.json());
  try {
    await connectMcpServer(body);
    const tools = await listMcpTools(body.id);
    return NextResponse.json({ connected: body.id, tools });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect" },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  disconnectMcp(id);
  return NextResponse.json({ disconnected: id });
}
