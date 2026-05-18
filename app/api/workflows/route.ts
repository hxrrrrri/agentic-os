import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteWorkflow, executeWorkflow, listWorkflows, upsertWorkflow } from "@/lib/workflows/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NodeSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["trigger", "skill", "condition", "output"]),
  label: z.string().min(1).max(120),
  skillId: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const EdgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  branch: z.enum(["true", "false"]).optional(),
});

const UpsertSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(160),
  description: z.string().max(2000).optional(),
  trigger: z.string().optional(),
  enabled: z.boolean().optional(),
  nodes: z.array(NodeSchema).min(1).max(200),
  edges: z.array(EdgeSchema).max(400),
});

const RunSchema = z.object({ id: z.string().min(1), prompt: z.string().optional() });
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const workflows = await listWorkflows();
  return NextResponse.json({ workflows });
}

export async function POST(request: Request) {
  try {
    const body = UpsertSchema.parse(await request.json());
    const wf = await upsertWorkflow(body);
    return NextResponse.json({ ok: true, workflow: wf });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = RunSchema.parse(await request.json());
    const result = await executeWorkflow(body.id, body.prompt);
    return NextResponse.json({ ok: true, result });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    await deleteWorkflow(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
