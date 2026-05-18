/**
 * Slack inbound slash-command receiver.
 *
 * Set up a Slack slash command (e.g. /agenticos) pointing to
 *   POST https://<your-host>/api/slack
 *
 * Required env vars:
 *   SLACK_SIGNING_SECRET  — for verifying request signatures (recommended)
 *   AGENTICOS_PUBLIC_URL  — so the Slack response links back to the right host
 *
 * The receiver accepts the standard Slack URL-encoded form payload, verifies
 * the signature, and starts a run with the provided text. Slack expects a
 * sub-3-second response, so we ack immediately and let the engine finish in
 * the background.
 */

import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "node:crypto";
import { startRun } from "@/lib/agent/engine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 10;

function verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
  const secret = process.env.SLACK_SIGNING_SECRET;
  if (!secret) return true; // allow if no secret configured
  // Reject replay attacks: timestamp must be within 5 minutes
  const tsNum = Number(timestamp);
  if (!tsNum || Math.abs(Date.now() / 1000 - tsNum) > 60 * 5) return false;
  const base = `v0:${timestamp}:${rawBody}`;
  const computed = `v0=${createHmac("sha256", secret).update(base).digest("hex")}`;
  if (computed.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

export async function POST(request: Request) {
  const raw = await request.text();
  const timestamp = request.headers.get("x-slack-request-timestamp") ?? "";
  const signature = request.headers.get("x-slack-signature") ?? "";

  if (!verifySignature(raw, timestamp, signature)) {
    return NextResponse.json({ response_type: "ephemeral", text: "Slack signature invalid" }, { status: 401 });
  }

  const params = new URLSearchParams(raw);
  const text = (params.get("text") ?? "").trim();
  const userName = params.get("user_name") ?? "anonymous";

  if (!text) {
    return NextResponse.json({ response_type: "ephemeral", text: "Usage: /agenticos <prompt>" });
  }

  try {
    const run = await startRun({ prompt: `Slack(${userName}): ${text}`, dryRun: true });
    const base = process.env.AGENTICOS_PUBLIC_URL ?? "";
    const link = base ? `<${base}/runs/${run.id}|run ${run.id}>` : `run ${run.id}`;
    return NextResponse.json({
      response_type: "in_channel",
      text: `:rocket: Started ${link}. I will post the result when the run completes.`,
    });
  } catch (err) {
    return NextResponse.json({
      response_type: "ephemeral",
      text: `:warning: Failed to start run: ${err instanceof Error ? err.message : "unknown"}`,
    });
  }
}
