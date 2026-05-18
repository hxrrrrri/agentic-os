"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, UserPlus, UserX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Member { id: string; userEmail: string; role: string }
interface Workspace { id: string; name: string; slug: string; createdAt: string; members?: Member[] }

const ROLES = ["owner", "admin", "operator", "viewer"];

export default function WorkspacesPage() {
  const [items, setItems]   = useState<Workspace[]>([]);
  const [busy, setBusy]     = useState(false);
  const [name, setName]     = useState("");
  const [memberForms, setMemberForms] = useState<Record<string, { email: string; role: string }>>({});

  const load = useCallback(async () => {
    const res = await fetch("/api/workspaces", { cache: "no-store" });
    const data = (await res.json()) as { workspaces: Workspace[] };
    setItems(data.workspaces);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const create = async () => {
    if (!name.trim()) return;
    setBusy(true);
    await fetch("/api/workspaces", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
    setName(""); setBusy(false); await load();
  };

  const addMember = async (workspaceId: string) => {
    const form = memberForms[workspaceId];
    if (!form?.email) return;
    setBusy(true);
    await fetch("/api/workspaces", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, email: form.email, role: form.role ?? "viewer" }) });
    setMemberForms((cur) => ({ ...cur, [workspaceId]: { email: "", role: form.role ?? "viewer" } }));
    setBusy(false); await load();
  };

  const removeMember = async (workspaceId: string, email: string) => {
    setBusy(true);
    await fetch("/api/workspaces", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceId, email }) });
    setBusy(false); await load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete workspace and all its members? Audit/run data is retained.")) return;
    setBusy(true);
    await fetch("/api/workspaces", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false); await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Team</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">WORKSPACES</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">Isolate work by team. Approvals + audit logs are stamped with the active workspace.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Create workspace</CardTitle></CardHeader>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Marketing"
            className="h-9 flex-1 border border-[#30342c] bg-[#080a09] px-2 text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
          />
          <Button type="button" onClick={() => void create()} disabled={busy || !name.trim()}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workspaces</CardTitle>
          <Badge tone="green">{items.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {items.length === 0 ? <div className="border border-dashed border-[#2a302c] p-4 text-center text-xs text-[#6f6a61]">No workspaces yet.</div> : null}
          {items.map((ws) => {
            const form = memberForms[ws.id] ?? { email: "", role: "viewer" };
            return (
              <div key={ws.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-[#f4f1e8]">{ws.name}</span>
                  <Badge tone="orange">{ws.slug}</Badge>
                  <Badge>{ws.members?.length ?? 0} members</Badge>
                  <span className="ml-auto text-[#6f6a61]">{new Date(ws.createdAt).toLocaleString()}</span>
                  <Button type="button" onClick={() => void remove(ws.id)}><Trash2 size={11} /></Button>
                </div>

                <div className="space-y-1">
                  {(ws.members ?? []).map((m) => (
                    <div key={m.id} className="flex items-center gap-2 border border-[#2a302c] bg-[#10120f] px-2 py-1">
                      <Badge tone={m.role === "owner" ? "green" : "gray"}>{m.role}</Badge>
                      <span className="text-[#a8a29a]">{m.userEmail}</span>
                      <Button type="button" onClick={() => void removeMember(ws.id, m.userEmail)} className="ml-auto"><UserX size={11} /></Button>
                    </div>
                  ))}
                </div>

                <div className="flex flex-wrap gap-2 pt-2">
                  <input
                    value={form.email}
                    onChange={(e) => setMemberForms((cur) => ({ ...cur, [ws.id]: { email: e.target.value, role: form.role } }))}
                    placeholder="person@team.com"
                    type="email"
                    className="h-8 min-w-44 flex-1 border border-[#30342c] bg-[#080a09] px-2 text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                  />
                  <select
                    value={form.role}
                    onChange={(e) => setMemberForms((cur) => ({ ...cur, [ws.id]: { email: form.email, role: e.target.value } }))}
                    className="h-8 border border-[#30342c] bg-[#080a09] px-2 text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                  </select>
                  <Button type="button" onClick={() => void addMember(ws.id)} disabled={busy || !form.email}><UserPlus size={11} /> Add</Button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
