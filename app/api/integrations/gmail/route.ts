import { NextResponse } from "next/server";
import { z } from "zod";
import { listRecentInbox } from "@/lib/integrations/gmail";
import { proposeAction } from "@/lib/approvals/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DraftSchema = z.object({
  mode: z.enum(["draft", "send"]),
  to: z.string().email(),
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(50_000),
  from: z.string().email().optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const max = Math.max(1, Math.min(50, Number(url.searchParams.get("max") ?? 15)));
  try {
    return NextResponse.json({ ok: true, inbox: await listRecentInbox(max) });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Gmail read failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const parsed = DraftSchema.parse(await request.json());
    const send = parsed.mode === "send";
    const approval = await proposeAction({
      action: send ? `Gmail send to ${parsed.to}` : `Gmail draft for ${parsed.to}`,
      integration: "gmail",
      affectedResource: parsed.to,
      commandOrPayload: JSON.stringify({
        to: parsed.to,
        subject: parsed.subject,
        body: parsed.body,
        from: parsed.from,
        send,
      }),
      riskLevel: send ? "critical" : "medium",
      explanation: send
        ? "Sends an email immediately on approve. Review the body carefully."
        : "Creates a draft in your Gmail Drafts folder on approve.",
    });
    return NextResponse.json({ ok: true, queued: true, approvalId: approval.id });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
