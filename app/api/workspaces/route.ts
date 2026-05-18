import { NextResponse } from "next/server";
import { z } from "zod";
import { addMember, createWorkspace, deleteWorkspace, listWorkspaces, removeMember } from "@/lib/workspaces/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({ name: z.string().min(1).max(120) });
const MemberSchema = z.object({
  workspaceId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["owner", "admin", "operator", "viewer"]),
});
const RemoveMemberSchema = z.object({ workspaceId: z.string().min(1), email: z.string().email() });
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const workspaces = await listWorkspaces();
  return NextResponse.json({ workspaces });
}

export async function POST(request: Request) {
  try {
    const body = CreateSchema.parse(await request.json());
    const ws = await createWorkspace(body.name);
    return NextResponse.json({ ok: true, workspace: ws }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  try {
    const body = MemberSchema.parse(await request.json());
    const member = await addMember(body.workspaceId, body.email, body.role);
    return NextResponse.json({ ok: true, member });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = RemoveMemberSchema.parse(await request.json());
    await removeMember(body.workspaceId, body.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    await deleteWorkspace(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
