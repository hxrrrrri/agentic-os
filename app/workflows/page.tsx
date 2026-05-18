"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Play, Plus, Save, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface Workflow {
  id: string;
  name: string;
  description?: string;
  trigger?: string;
  enabled: boolean;
  nodes: Array<{ id: string; kind: string; label: string; skillId?: string; config?: Record<string, unknown> }>;
  edges: Array<{ from: string; to: string; branch?: string }>;
  createdAt: string;
  updatedAt: string;
}

const TEMPLATE = `{
  "name": "Daily research → vault note",
  "description": "Fetch HN top + write summary to vault",
  "trigger": "manual",
  "nodes": [
    { "id": "t1", "kind": "trigger", "label": "Start", "config": { "prompt": "Top of Hacker News today" } },
    { "id": "s1", "kind": "skill", "label": "Research", "skillId": "deep-research", "config": { "prompt": "\${t1.output}" } },
    { "id": "o1", "kind": "output", "label": "Done", "config": { "template": "Wrote run: \${s1.output}" } }
  ],
  "edges": [
    { "from": "t1", "to": "s1" },
    { "from": "s1", "to": "o1" }
  ]
}`;

export default function WorkflowsPage() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [editor, setEditor]       = useState(TEMPLATE);
  const [busy, setBusy]           = useState(false);
  const [msg, setMsg]             = useState<string | null>(null);
  const [err, setErr]             = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/workflows", { cache: "no-store" });
    const data = (await res.json()) as { workflows: Workflow[] };
    setWorkflows(data.workflows);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const save = async () => {
    setBusy(true); setErr(null); setMsg(null);
    try {
      const parsed = JSON.parse(editor);
      const res = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parsed) });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error ?? "Save failed");
      setMsg(`Saved ${data.workflow.id}`); await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Bad JSON"); }
    finally { setBusy(false); }
  };

  const run = async (id: string) => {
    setBusy(true);
    const res = await fetch("/api/workflows", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    const data = await res.json();
    setMsg(`Ran ${id}: ${data.result?.steps?.length ?? 0} steps`);
    setBusy(false);
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch("/api/workflows", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false); await load();
  };

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Automate</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">WORKFLOWS</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">DAG of skills with conditional branches. Use <code className="text-[#e86f3a]">${"{nodeId.output}"}</code> to reference upstream outputs.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Editor</CardTitle></CardHeader>
        <textarea
          value={editor}
          onChange={(e) => setEditor(e.target.value)}
          rows={16}
          className="w-full resize-y border border-[#30342c] bg-[#080a09] p-2 font-mono text-xs text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
        />
        {err ? <div className="mt-2 text-xs text-[#c4605a]">{err}</div> : null}
        {msg ? <div className="mt-2 text-xs text-[#79a875]">{msg}</div> : null}
        <div className="mt-3 flex gap-2">
          <Button type="button" onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />} Save
          </Button>
          <Button type="button" onClick={() => setEditor(TEMPLATE)}>
            <Plus size={11} /> New
          </Button>
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Saved workflows</CardTitle>
          <Badge tone="green">{workflows.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {workflows.length === 0 ? <div className="border border-dashed border-[#2a302c] p-4 text-center text-xs text-[#6f6a61]">No workflows yet.</div> : null}
          {workflows.map((w) => (
            <div key={w.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold text-[#f4f1e8]">{w.name}</span>
                <Badge tone={w.enabled ? "green" : "gray"}>{w.enabled ? "enabled" : "disabled"}</Badge>
                <Badge tone="orange">{w.nodes.length} nodes</Badge>
                {w.trigger ? <Badge>trigger: {w.trigger}</Badge> : null}
                <span className="ml-auto text-[#6f6a61]">{new Date(w.updatedAt).toLocaleString()}</span>
              </div>
              {w.description ? <div className="text-[#a8a29a]">{w.description}</div> : null}
              <div className="font-mono text-[0.62rem] text-[#6f6a61]">{w.nodes.map((n) => `${n.kind}:${n.label}`).join(" → ")}</div>
              <div className="flex gap-2">
                <Button type="button" onClick={() => void run(w.id)} disabled={busy}><Play size={11} /> Run</Button>
                <Button type="button" onClick={() => setEditor(JSON.stringify({ id: w.id, name: w.name, description: w.description, trigger: w.trigger, enabled: w.enabled, nodes: w.nodes, edges: w.edges }, null, 2))}>Load into editor</Button>
                <Button type="button" onClick={() => void remove(w.id)} disabled={busy}><Trash2 size={11} /> Delete</Button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
