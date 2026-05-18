"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Inbox as InboxIcon, Loader2, Pencil, Send, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface InboxItem {
  id: string;
  source: string;
  sender?: string;
  subject?: string;
  body: string;
  status: string;
  draftReply?: string;
  runId?: string;
  receivedAt: string;
}

interface InboxStats { total: number; new: number; drafted: number; sent: number }

export default function InboxPage() {
  const [items, setItems]   = useState<InboxItem[]>([]);
  const [stats, setStats]   = useState<InboxStats>({ total: 0, new: 0, drafted: 0, sent: 0 });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: string } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/inbox", { cache: "no-store" });
    const data = (await res.json()) as { stats: InboxStats; items: InboxItem[] };
    setStats(data.stats);
    setItems(data.items);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
    const id = setInterval(() => void load(), 8_000);
    return () => clearInterval(id);
  }, [load]);

  const act = async (id: string, action: string, draftReply?: string) => {
    setBusyId(id);
    await fetch("/api/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action, draftReply }),
    });
    setBusyId(null);
    setEditing(null);
    await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Operator</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">INBOX</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Unified queue. Agent drafts; you approve before anything leaves the building.</p>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: "Total", value: stats.total },
          { label: "New", value: stats.new },
          { label: "Drafted", value: stats.drafted },
          { label: "Sent", value: stats.sent },
        ].map((s) => (
          <div key={s.label} className="border border-[#2a302c] bg-[#080a09] p-3 text-xs">
            <div className="terminal-label">{s.label}</div>
            <div className="mt-2 text-2xl font-bold text-[#f4f1e8]">{s.value}</div>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Messages</CardTitle>
          <Badge tone="green">{items.length} loaded</Badge>
        </CardHeader>
        <div className="space-y-2">
          {items.length === 0 ? (
            <div className="border border-dashed border-[#2a302c] p-6 text-center text-xs text-[#6f6a61]">
              <InboxIcon className="mx-auto mb-2 text-[#3d4239]" />
              Empty. Pipe Gmail/Slack into <code className="text-[#e86f3a]">POST /api/inbox</code> to populate.
            </div>
          ) : null}
          {items.map((item) => {
            const isEditing = editing?.id === item.id;
            return (
              <div key={item.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="orange">{item.source}</Badge>
                  <Badge tone={item.status === "new" ? "yellow" : item.status === "draft_ready" ? "green" : "gray"}>{item.status}</Badge>
                  <span className="text-[#a8a29a]">{item.sender ?? "—"}</span>
                  <span className="ml-auto text-[#6f6a61]">{new Date(item.receivedAt).toLocaleString()}</span>
                </div>
                {item.subject ? <div className="text-sm text-[#f4f1e8]">{item.subject}</div> : null}
                <div className="max-h-40 overflow-auto whitespace-pre-wrap text-[#a8a29a] thin-scrollbar">{item.body}</div>
                {item.draftReply || isEditing ? (
                  <div className="border border-[#2a302c] bg-[#10120f] p-2">
                    <div className="terminal-label flex items-center gap-1"><Sparkles size={10} /> Draft reply</div>
                    {isEditing ? (
                      <textarea
                        value={editing!.draft}
                        onChange={(e) => setEditing({ id: item.id, draft: e.target.value })}
                        rows={6}
                        className="mt-2 w-full resize-y border border-[#30342c] bg-[#080a09] p-2 text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                      />
                    ) : (
                      <div className="mt-2 whitespace-pre-wrap text-[#f4f1e8]">{item.draftReply}</div>
                    )}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-2">
                  {item.status === "new" ? (
                    <Button type="button" onClick={() => void act(item.id, "draft")} disabled={busyId === item.id}>
                      {busyId === item.id ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />} Draft
                    </Button>
                  ) : null}
                  {item.draftReply && !isEditing ? (
                    <Button type="button" onClick={() => setEditing({ id: item.id, draft: item.draftReply ?? "" })}>
                      <Pencil size={11} /> Edit
                    </Button>
                  ) : null}
                  {isEditing ? (
                    <Button type="button" onClick={() => void act(item.id, "edit_draft", editing!.draft)} disabled={busyId === item.id}>
                      Save
                    </Button>
                  ) : null}
                  {item.draftReply ? (
                    <Button type="button" onClick={() => void act(item.id, "approve_send")} disabled={busyId === item.id}>
                      <Send size={11} /> Queue send
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => void act(item.id, "archive")} disabled={busyId === item.id}>
                    <Archive size={11} /> Archive
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
