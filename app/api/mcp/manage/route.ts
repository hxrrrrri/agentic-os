import { NextResponse } from "next/server";
import { z } from "zod";
import { MCP_CATALOG } from "@/lib/mcp/catalog";
import {
  CLI_TARGETS,
  checkCredentials,
  getConfigPath,
  installServer,
  listAllStatus,
  uninstallServer,
  type CliTarget,
} from "@/lib/mcp/configurator";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InstallSchema = z.object({
  serverId: z.string(),
  target: z.enum(["claude-code", "codex", "gemini-cli"]),
});

const TargetEnum = ["claude-code", "codex", "gemini-cli"] as const;

export async function GET() {
  const statuses = await listAllStatus();
  const creds = await Promise.all(MCP_CATALOG.map((s) => checkCredentials(s.id)));
  const configPaths: Record<CliTarget, string> = {
    "claude-code": getConfigPath("claude-code"),
    codex: getConfigPath("codex"),
    "gemini-cli": getConfigPath("gemini-cli"),
  };
  return NextResponse.json({
    catalog: MCP_CATALOG,
    targets: TargetEnum,
    configPaths,
    statuses,
    credentials: creds,
  });
}

export async function POST(request: Request) {
  try {
    const body = InstallSchema.parse(await request.json());
    const result = await installServer(body.serverId, body.target);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = InstallSchema.parse(await request.json());
    const result = await uninstallServer(body.serverId, body.target);
    return NextResponse.json(result, { status: result.ok ? 200 : 500 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}

// Bulk-install across all configured CLIs for convenience.
export async function PUT(request: Request) {
  try {
    const body = z.object({ serverId: z.string() }).parse(await request.json());
    const results = await Promise.all(CLI_TARGETS.map((t) => installServer(body.serverId, t)));
    return NextResponse.json({ ok: results.every((r) => r.ok), results });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
