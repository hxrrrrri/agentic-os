"use client";

import { useCallback, useEffect, useState } from "react";
import { Cog, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface TraceStep { type: string; selector?: string; value?: string; url?: string; description?: string }
interface Trace { id: string; name: string; startUrl?: string; steps: TraceStep[]; createdAt: string; compiledSkillId?: string }

const EMPTY = `{
  "name": "Login flow",
  "startUrl": "https://example.com/login",
  "steps": [
    { "type": "navigate", "url": "https://example.com/login" },
    { "type": "fill", "selector": "#email", "value": "user@example.com" },
    { "type": "fill", "selector": "#password", "value": "{{PASSWORD}}" },
    { "type": "click", "selector": "button[type=submit]" }
  ]
}`;

export default function RecorderPage() {
  const [traces, setTraces]   = useState<Trace[]>([]);
  const [text, setText]       = useState(EMPTY);
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/browser/record", { cache: "no-store" });
    const data = (await res.json()) as { traces: Trace[] };
    setTraces(data.traces);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const upload = async () => {
    setBusy(true); setErr(null);
    try {
      const parsed = JSON.parse(text);
      const res = await fetch("/api/browser/record", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Upload failed");
      await load();
      setText(EMPTY);
    } catch (e) { setErr(e instanceof Error ? e.message : "bad JSON"); }
    finally { setBusy(false); }
  };

  const compile = async (id: string) => {
    setBusy(true);
    await fetch("/api/browser/record", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false); await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch("/api/browser/record", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false); await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Capture</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">BROWSER RECORDER</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Record a click-flow once. Compile it into a reusable skill that any model can replay through the browser tool.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Upload trace JSON</CardTitle></CardHeader>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={12}
          className="w-full resize-y border border-[#30342c] bg-[#080a09] p-2 font-mono text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
        />
        {err ? <div className="mt-2 text-xs text-[#c4605a]">{err}</div> : null}
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => void upload()} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Save trace
          </Button>
        </div>
        <p className="mt-2 text-[0.65rem] text-[#6f6a61]">
          Tip: use the bookmarklet at <code className="text-[#e86f3a]">vault/skills/browser-recorder-bookmarklet.md</code> or paste Playwright codegen JSON.
        </p>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved traces</CardTitle>
          <Badge tone="green">{traces.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {traces.length === 0 ? <div className="border border-dashed border-[#2a302c] p-4 text-center text-xs text-[#6f6a61]">No traces yet.</div> : null}
          {traces.map((t) => (
            <div key={t.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#f4f1e8]">{t.name}</span>
                <Badge tone="orange">{t.steps.length} steps</Badge>
                {t.compiledSkillId ? <Badge tone="green">compiled: {t.compiledSkillId}</Badge> : <Badge tone="gray">not compiled</Badge>}
                <span className="ml-auto text-[#6f6a61]">{new Date(t.createdAt).toLocaleString()}</span>
              </div>
              {t.startUrl ? <div className="truncate text-[#a8a29a]">{t.startUrl}</div> : null}
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => void compile(t.id)} disabled={busy}>
                  <Cog size={11} /> {t.compiledSkillId ? "Recompile" : "Compile to skill"}
                </Button>
                <Button type="button" onClick={() => void remove(t.id)} disabled={busy}>
                  <Trash2 size={11} /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
