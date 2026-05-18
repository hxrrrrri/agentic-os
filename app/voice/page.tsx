"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, Send, Square } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface VoiceIntent { id: string; transcript: string; intent?: string; skillId?: string; runId?: string; createdAt: string }

export default function VoicePage() {
  const [intents, setIntents]   = useState<VoiceIntent[]>([]);
  const [text, setText]         = useState("");
  const [busy, setBusy]         = useState(false);
  const [recording, setRecording] = useState(false);
  const [err, setErr]           = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const load = useCallback(async () => {
    const res = await fetch("/api/voice/dispatch", { cache: "no-store" });
    const data = (await res.json()) as { intents: VoiceIntent[] };
    setIntents(data.intents);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const sendText = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    const res = await fetch("/api/voice/dispatch", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transcript: text }),
    });
    const data = await res.json();
    if (!data.ok) setErr(data.error ?? "dispatch failed");
    setText(""); setBusy(false); await load();
  };

  const startRecording = async () => {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        setBusy(true);
        const form = new FormData();
        form.append("audio", blob, "voice.webm");
        const res = await fetch("/api/voice/dispatch", { method: "POST", body: form });
        const data = await res.json();
        if (!data.ok) setErr(data.error ?? "dispatch failed");
        setBusy(false); await load();
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Mic permission denied");
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Voice</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">VOICE COMMAND</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Speak or type. AgenticOS transcribes via Whisper, classifies intent, dispatches to a skill. Mic uses your browser; transcript hits OpenAI/Groq Whisper.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Capture</CardTitle></CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          {recording ? (
            <Button type="button" onClick={stopRecording}><Square size={11} /> Stop</Button>
          ) : (
            <Button type="button" onClick={() => void startRecording()} disabled={busy}><Mic size={11} /> Record</Button>
          )}
          <span className="text-xs text-[#6f6a61]">or type:</span>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Run the morning brief"
            className="h-9 flex-1 border border-[#30342c] bg-[#080a09] px-2 text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
            onKeyDown={(e) => { if (e.key === "Enter") void sendText(); }}
          />
          <Button type="button" onClick={() => void sendText()} disabled={busy || !text.trim()}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />} Dispatch
          </Button>
        </div>
        {err ? <div className="mt-2 text-xs text-[#c4605a]">{err}</div> : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent voice intents</CardTitle>
          <Badge tone="green">{intents.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {intents.map((i) => (
            <div key={i.id} className="space-y-1 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                {i.intent ? <Badge tone="orange">{i.intent}</Badge> : null}
                {i.skillId ? <Badge>skill: {i.skillId}</Badge> : null}
                {i.runId ? <Badge tone="green">run: {i.runId.slice(-8)}</Badge> : null}
                <span className="ml-auto text-[#6f6a61]">{new Date(i.createdAt).toLocaleString()}</span>
              </div>
              <div className="text-[#f4f1e8]">{i.transcript}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
