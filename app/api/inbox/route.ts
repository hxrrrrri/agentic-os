import { NextResponse } from "next/server";
import { z } from "zod";
import { getInboxItem, ingestInboxItem, inboxStats, listInbox, updateInboxItem, type InboxStatus } from "@/lib/inbox/store";
import { startRun } from "@/lib/agent/engine";
import { proposeAction } from "@/lib/approvals/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IngestSchema = z.object({
  source: z.enum(["gmail", "slack", "discord", "webhook", "manual"]),
  sender: z.string().max(320).optional(),
  subject: z.string().max(400).optional(),
  body: z.string().min(1).max(50_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PatchSchema = z.object({
  id: z.string().min(1),
  action: z.enum(["draft", "approve_send", "edit_draft", "archive", "snooze"]),
  draftReply: z.string().max(50_000).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const statusParam = url.searchParams.get("status") as InboxStatus | null;
  const stats = await inboxStats();
  const items = await listInbox(Number(url.searchParams.get("limit") ?? 100), statusParam ?? undefined);
  return NextResponse.json({ stats, items });
}

export async function POST(request: Request) {
  try {
    const body = IngestSchema.parse(await request.json());
    const item = await ingestInboxItem(body);
    return NextResponse.json({ ok: true, item }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = PatchSchema.parse(await request.json());
    const item = await getInboxItem(body.id);
    if (!item) return NextResponse.json({ ok: false, error: "Inbox item not found" }, { status: 404 });

    switch (body.action) {
      case "draft": {
        await updateInboxItem(body.id, { status: "drafting" });
        const subject = item.subject ? `Re: ${item.subject}` : "Reply";
        const prompt = [
          `Draft a reply to this ${item.source} message.`,
          item.sender ? `From: ${item.sender}` : null,
          item.subject ? `Subject: ${item.subject}` : null,
          "",
          "Message:",
          item.body,
          "",
          "Reply requirements: match the sender's tone, be concise, propose concrete next steps if needed. Do not invent facts.",
        ].filter(Boolean).join("\n");
        const skillId = item.source === "gmail" ? "gmail-drafts" : "inbox-triage";
        const run = await startRun({ prompt, skillId, dryRun: true });
        await updateInboxItem(body.id, { status: "draft_ready", runId: run.id, draftReply: subject });
        return NextResponse.json({ ok: true, runId: run.id });
      }
      case "edit_draft": {
        if (!body.draftReply) return NextResponse.json({ ok: false, error: "draftReply required" }, { status: 400 });
        await updateInboxItem(body.id, { draftReply: body.draftReply, status: "draft_ready" });
        return NextResponse.json({ ok: true });
      }
      case "approve_send": {
        await proposeAction({
          action: `Send ${item.source} reply to ${item.sender ?? "unknown"}`,
          integration: item.source,
          affectedResource: item.sender ?? item.source,
          commandOrPayload: item.draftReply ?? "(empty)",
          riskLevel: "medium",
          explanation: "Outbound message to external recipient — requires explicit approval.",
        });
        await updateInboxItem(body.id, { status: "approved" });
        return NextResponse.json({ ok: true });
      }
      case "archive":
        await updateInboxItem(body.id, { status: "archived" });
        return NextResponse.json({ ok: true });
      case "snooze":
        await updateInboxItem(body.id, { status: "snoozed" });
        return NextResponse.json({ ok: true });
    }
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
