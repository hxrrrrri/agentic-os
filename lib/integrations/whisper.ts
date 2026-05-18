/**
 * Whisper transcription adapter.
 *
 * Provider order:
 *   1. GROQ_API_KEY     → whisper-large-v3-turbo (cheap + fast)
 *   2. OPENAI_API_KEY   → whisper-1
 *
 * Pass a Blob/File (e.g. from request.formData()).
 */

import { getSecret } from "@/lib/secrets/store";

export interface TranscriptResult {
  text: string;
  model: string;
  durationMs: number;
}

async function transcribeRemote(blob: Blob, url: string, model: string, apiKey: string): Promise<string> {
  const form = new FormData();
  form.append("file", blob, "audio.bin");
  form.append("model", model);
  form.append("response_format", "json");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Whisper ${url} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { text?: string };
  return json.text ?? "";
}

export async function transcribe(blob: Blob): Promise<TranscriptResult> {
  const started = Date.now();
  const groq = await getSecret("GROQ_API_KEY");
  if (groq) {
    try {
      const text = await transcribeRemote(blob, "https://api.groq.com/openai/v1/audio/transcriptions", "whisper-large-v3-turbo", groq);
      return { text, model: "groq/whisper-large-v3-turbo", durationMs: Date.now() - started };
    } catch {
      // fall through
    }
  }
  const openai = await getSecret("OPENAI_API_KEY");
  if (openai) {
    const text = await transcribeRemote(blob, "https://api.openai.com/v1/audio/transcriptions", "whisper-1", openai);
    return { text, model: "openai/whisper-1", durationMs: Date.now() - started };
  }
  throw new Error("No transcription provider configured (GROQ_API_KEY or OPENAI_API_KEY)");
}
