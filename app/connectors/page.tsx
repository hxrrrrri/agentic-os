"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plug, Plus, Power, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";

interface ConnectorSpec { id: string; name: string; category: string; description: string; secretKeys: string[]; tools: string[]; docsUrl?: string }
interface Installed { id: string; connectorId: string; label?: string; enabled: boolean; installedAt: string; missingSecrets: string[] }

export default function ConnectorsPage() {
  const [catalog, setCatalog]     = useState<ConnectorSpec[]>([]);
  const [installed, setInstalled] = useState<Installed[]>([]);
  const [busy, setBusy]           = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/connectors", { cache: "no-store" });
    const data = await res.json();
    setCatalog(data.catalog); setInstalled(data.installed);
  }, []);

  useEffect(() => {
    queueMicrotask(() => void load());
  }, [load]);

  const grouped = useMemo(() => {
    const map = new Map<string, ConnectorSpec[]>();
    for (const c of catalog) {
      const list = map.get(c.category) ?? [];
      list.push(c);
      map.set(c.category, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [catalog]);

  const install = async (connectorId: string) => {
    setBusy(true);
    await fetch("/api/connectors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ connectorId }) });
    setBusy(false); await load();
  };

  const toggle = async (id: string, enabled: boolean) => {
    setBusy(true);
    await fetch("/api/connectors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, enabled }) });
    setBusy(false); await load();
  };

  const remove = async (id: string) => {
    setBusy(true);
    await fetch("/api/connectors", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    setBusy(false); await load();
  };

  const installedByConnector = new Map(installed.map((i) => [i.connectorId, i]));

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Marketplace</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">CONNECTORS</h1>
        <p className="mt-2 text-xs text-[#a8a29a]">One-click install. Credentials are pulled from the encrypted secret store at runtime — never embedded in catalog records.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Installed</CardTitle>
          <Badge tone="green">{installed.length}</Badge>
        </CardHeader>
        <div className="space-y-2">
          {installed.length === 0 ? <div className="border border-dashed border-[#2a302c] p-4 text-center text-xs text-[#6f6a61]">No connectors installed.</div> : null}
          {installed.map((i) => {
            const spec = catalog.find((c) => c.id === i.connectorId);
            return (
              <div key={i.id} className="flex flex-wrap items-center gap-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                <Plug size={11} className={i.enabled ? "text-[#79a875]" : "text-[#6f6a61]"} />
                <span className="text-sm font-bold text-[#f4f1e8]">{spec?.name ?? i.connectorId}</span>
                <Badge tone={i.enabled ? "green" : "gray"}>{i.enabled ? "enabled" : "disabled"}</Badge>
                {i.missingSecrets.length ? <Badge tone="yellow">missing {i.missingSecrets.length} secret(s)</Badge> : null}
                <span className="ml-auto text-[#6f6a61]">{new Date(i.installedAt).toLocaleString()}</span>
                <Button type="button" onClick={() => void toggle(i.id, !i.enabled)} disabled={busy}><Power size={11} /></Button>
                <Button type="button" onClick={() => void remove(i.id)} disabled={busy}><Trash2 size={11} /></Button>
              </div>
            );
          })}
        </div>
      </Card>

      {grouped.map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader>
            <CardTitle className="capitalize">{cat}</CardTitle>
            <Badge>{items.length}</Badge>
          </CardHeader>
          <div className="grid gap-2 md:grid-cols-2">
            {items.map((c) => {
              const inst = installedByConnector.get(c.id);
              return (
                <div key={c.id} className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-[#f4f1e8]">{c.name}</span>
                    {inst ? <Badge tone="green">installed</Badge> : null}
                  </div>
                  <div className="text-[#a8a29a]">{c.description}</div>
                  <div className="flex flex-wrap gap-1">
                    {c.tools.length ? c.tools.map((t) => <Badge key={t}>{t}</Badge>) : <Badge tone="gray">catalog only</Badge>}
                  </div>
                  {c.secretKeys.length ? (
                    <div className="text-[0.62rem] text-[#6f6a61]">
                      Needs: <span className="font-mono">{c.secretKeys.join(", ")}</span>
                    </div>
                  ) : null}
                  <div className="flex gap-2">
                    {inst ? (
                      <Button type="button" onClick={() => void remove(inst.id)} disabled={busy}><Trash2 size={11} /> Uninstall</Button>
                    ) : (
                      <Button type="button" onClick={() => void install(c.id)} disabled={busy}><Plus size={11} /> Install</Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}

      {busy ? <div className="fixed right-4 top-4 flex items-center gap-2 rounded-[3px] border border-[#2a302c] bg-[#080a09] px-3 py-2 text-xs"><Loader2 size={12} className="animate-spin" /> working…</div> : null}
    </div>
  );
}
