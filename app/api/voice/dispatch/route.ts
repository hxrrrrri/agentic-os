import { NextResponse } from "next/server";
import { dispatchVoice, listVoiceIntents } from "@/lib/voice/dispatch";
import { transcribe } from "@/lib/integrations/whisper";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const intents = await listVoiceIntents(50);
  return NextResponse.json({ intents });
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let transcript: string;
    let transcriptModel: string | undefined;

    if (contentType.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("audio");
      if (!(file instanceof Blob)) {
        return NextResponse.json({ ok: false, error: "audio file required" }, { status: 400 });
      }
      const result = await transcribe(file);
      transcript = result.text;
      transcriptModel = result.model;
    } else {
      const body = (await request.json()) as { transcript?: string };
      if (!body.transcript) {
        return NextResponse.json({ ok: false, error: "transcript required" }, { status: 400 });
      }
      transcript = body.transcript;
    }

    if (!transcript.trim()) {
      return NextResponse.json({ ok: false, error: "transcript empty" }, { status: 400 });
    }

    const intent = await dispatchVoice(transcript);
    return NextResponse.json({ ok: true, intent, transcriptModel });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Voice dispatch failed" }, { status: 500 });
  }
}
