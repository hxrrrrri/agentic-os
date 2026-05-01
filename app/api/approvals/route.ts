import { NextResponse } from "next/server";
import { z } from "zod";
import { listApprovals, updateApproval } from "@/lib/db/repositories";

export const runtime = "nodejs";

const PatchSchema = z.object({
  id: z.string(),
  status: z.enum(["approved", "rejected"]),
});

export async function GET() {
  const approvals = await listApprovals();
  return NextResponse.json({ approvals });
}

export async function PATCH(request: Request) {
  const body = PatchSchema.parse(await request.json());
  await updateApproval(body.id, body.status);
  return NextResponse.json({ approvals: await listApprovals() });
}
