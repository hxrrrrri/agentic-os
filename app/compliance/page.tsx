"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Download, Loader2, Lock, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Snapshot { id: string; path: string; size: number; createdAt: string }
interface ComplianceEvent { id: string; kind: string; subject?: string; affectedRows?: number; detail?: string; createdAt: string }

export default function CompliancePage() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [events, setEvents]       = useState<ComplianceEvent[]>([]);
  const [busy, setBusy]           = useState(false);
  const [subject, setSubject]     = useState("");
  const [confirm, setConfirm]     = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);

  const load = useCallback(async () => {
    const [snapRes, eventRes] = await Promise.all([
      fetch("/api/compliance/snapshot", { cache: "no-store" }),
      fetch("/api/compliance/gdpr-delete", { cache: "no-store" }),
    ]);
    const snapData  = (await snapRes.json()) as { snapshots: Snapshot[] };
    const eventData = (await eventRes.json()) as { events: ComplianceEvent[] };
    setSnapshots(snapData.snapshots);
    setEvents(eventData.events);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const createSnapshot = async () => {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/compliance/snapshot", { method: "POST" });
    const data = await res.json();
    if (data.ok) setMsg(`Snapshot ${data.snapshot.id} — ${data.snapshot.files} files`);
    setBusy(false); await load();
  };

  const gdprErase = async () => {
    if (!subject.trim() || !confirm) return;
    setBusy(true); setMsg(null);
    const res = await fetch("/api/compliance/gdpr-delete", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject: subject.trim(), confirm: true }),
    });
    const data = await res.json();
    if (data.ok) setMsg(`Erased: vault ${data.result.vaultFilesRedacted} files / db ${data.result.dbRowsRedacted} rows`);
    setBusy(false); setSubject(""); setConfirm(false); await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Compliance</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">COMPLIANCE PACK</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Encrypted vault snapshots, audit-log CSV export, subject erasure across vault + DB.</p>
      </div>

      {msg ? <div className="border border-[#79a875]/40 bg-[#0d1a0d] p-3 text-xs text-[#9fc39b]">{msg}</div> : null}

      <Card>
        <CardHeader>
          <CardTitle>Encrypted vault snapshots</CardTitle>
          <Badge tone="green">{snapshots.length}</Badge>
        </CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void createSnapshot()} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Lock size={11} />} Snapshot now
          </Button>
          <span className="text-[0.65rem] text-[#6f6a61]">AES-256-GCM with the same key as the secret store.</span>
        </div>
        <div className="mt-2 space-y-1">
          {snapshots.map((s) => (
            <div key={s.id} className="flex items-center gap-2 border border-[#2a302c] bg-[#080a09] px-2 py-1 text-xs">
              <Badge tone="orange">{s.id}</Badge>
              <span className="truncate font-mono text-[#a8a29a]">{s.path}</span>
              <span className="ml-auto text-[#6f6a61]">{(s.size / 1024).toFixed(1)} KB · {new Date(s.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Audit log export</CardTitle>
        </CardHeader>
        <a href="/api/compliance/audit-export" className="inline-flex">
          <Button type="button"><Download size={11} /> Download CSV (all audit logs)</Button>
        </a>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subject erasure (GDPR)</CardTitle>
          <Badge tone="yellow"><AlertTriangle size={10} /> destructive</Badge>
        </CardHeader>
        <div className="space-y-2 text-xs">
          <p className="text-[#a8a29a]">Removes any occurrence of the subject string across inbox, audit logs, memory, approvals, and vault markdown. Replaced by <code className="text-[#e86f3a]">[ERASED]</code>.</p>
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="email@example.com or full name"
            className="h-9 w-full border border-[#30342c] bg-[#080a09] px-2 text-[#f4f1e8] outline-none focus:border-[#c4605a]"
          />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} />
            <span>I understand this rewrites files irreversibly.</span>
          </label>
          <Button type="button" onClick={() => void gdprErase()} disabled={busy || !subject.trim() || !confirm}>
            <Shield size={11} /> Erase subject
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader><CardTitle>Compliance event log</CardTitle></CardHeader>
        <div className="space-y-1 text-xs">
          {events.length === 0 ? <div className="text-[#6f6a61]">No events yet.</div> : null}
          {events.map((e) => (
            <div key={e.id} className="flex items-center gap-2 border border-[#2a302c] bg-[#080a09] px-2 py-1">
              <Badge tone="orange">{e.kind}</Badge>
              {e.subject ? <span className="text-[#a8a29a]">{e.subject}</span> : null}
              {e.affectedRows ? <Badge>{e.affectedRows} rows</Badge> : null}
              <span className="ml-auto text-[#6f6a61]">{new Date(e.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
