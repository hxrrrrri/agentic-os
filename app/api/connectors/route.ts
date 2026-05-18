import { NextResponse } from "next/server";
import { z } from "zod";
import { CONNECTOR_CATALOG, installConnector, listInstalledConnectors, toggleConnector, uninstallConnector } from "@/lib/connectors/catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const InstallSchema = z.object({
  connectorId: z.string().min(1),
  label: z.string().max(120).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const ToggleSchema = z.object({ id: z.string().min(1), enabled: z.boolean() });
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const installed = await listInstalledConnectors();
  return NextResponse.json({ catalog: CONNECTOR_CATALOG, installed });
}

export async function POST(request: Request) {
  try {
    const body = InstallSchema.parse(await request.json());
    const installed = await installConnector(body.connectorId, body.label, body.config);
    return NextResponse.json({ ok: true, installed }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = ToggleSchema.parse(await request.json());
    await toggleConnector(body.id, body.enabled);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    await uninstallConnector(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
