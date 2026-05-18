"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, Loader2, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { McpServerSpec } from "@/lib/mcp/catalog";

type CliTarget = "claude-code" | "codex" | "gemini-cli";

interface ServerStatus {
  serverId: string;
  installed: Record<CliTarget, boolean>;
}

interface CredStatus {
  serverId: string;
  missing: string[];
}

interface Payload {
  catalog: McpServerSpec[];
  targets: CliTarget[];
  configPaths: Record<CliTarget, string>;
  statuses: ServerStatus[];
  credentials: CredStatus[];
}

const CATEGORY_LABEL: Record<McpServerSpec["category"], string> = {
  agenticos: "AgenticOS",
  dev: "Developer",
  search: "Search",
  browser: "Browser",
  ops: "Ops",
  data: "Data",
};

const TARGET_LABEL: Record<CliTarget, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  "gemini-cli": "Gemini CLI",
};

export function McpManager() {
  const [data, setData] = useState<Payload | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const reload = () =>
    fetch("/api/mcp/manage")
      .then((r) => r.json())
      .then((d: Payload) => setData(d))
      .catch(() => {});

  useEffect(() => {
    reload();
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<[McpServerSpec["category"], McpServerSpec[]]>;
    const map = new Map<McpServerSpec["category"], McpServerSpec[]>();
    for (const spec of data.catalog) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return Array.from(map.entries());
  }, [data]);

  const install = async (serverId: string, target: CliTarget) => {
    const k = `${serverId}::${target}`;
    setBusy((b) => ({ ...b, [k]: true }));
    await fetch("/api/mcp/manage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId, target }),
    });
    setBusy((b) => ({ ...b, [k]: false }));
    await reload();
  };

  const uninstall = async (serverId: string, target: CliTarget) => {
    const k = `${serverId}::${target}`;
    setBusy((b) => ({ ...b, [k]: true }));
    await fetch("/api/mcp/manage", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId, target }),
    });
    setBusy((b) => ({ ...b, [k]: false }));
    await reload();
  };

  const installAll = async (serverId: string) => {
    const k = `${serverId}::*`;
    setBusy((b) => ({ ...b, [k]: true }));
    await fetch("/api/mcp/manage", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ serverId }),
    });
    setBusy((b) => ({ ...b, [k]: false }));
    await reload();
  };

  if (!data) return <div className="p-4 text-sm text-[#6f6a61]">Loading MCP catalog…</div>;

  const statusFor = (id: string) => data.statuses.find((s) => s.serverId === id)?.installed;
  const missingFor = (id: string) => data.credentials.find((c) => c.serverId === id)?.missing ?? [];

  return (
    <div className="space-y-5">
      <p className="text-[0.78rem] leading-5 text-[#a8a29a]">
        Install an MCP server into one or more CLI providers. The configurator writes the right config file using credentials from
        the encrypted secret store — so you only enter each token once and every CLI gets it. <strong>AgenticOS (local)</strong>{" "}
        exposes every direct adapter (Instagram, TikTok, YouTube, Stripe, Shopify, HubSpot, Pipedrive, Salesforce, Calendar, Drive,
        Firecrawl) as MCP tools, filling the gap where no third-party MCP exists.
      </p>

      <details className="rounded-[3px] border border-[#2a302c] bg-[#080a09] p-3 text-[0.7rem] text-[#a8a29a]">
        <summary className="cursor-pointer text-[#f4f1e8]">Config file paths</summary>
        <ul className="mt-2 space-y-1 font-mono text-[0.7rem]">
          {(Object.keys(data.configPaths) as CliTarget[]).map((t) => (
            <li key={t}>
              <span className="text-[#e86f3a]">{TARGET_LABEL[t]}</span> · <span>{data.configPaths[t]}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[0.65rem] text-[#6f6a61]">
          Restart each CLI after install/uninstall so it re-reads its config. For `npx` servers the first launch downloads the
          package — give it a few seconds.
        </p>
      </details>

      {grouped.map(([category, specs]) => (
        <div key={category} className="space-y-2">
          <div className="terminal-label">{CATEGORY_LABEL[category]}</div>
          <div className="grid gap-2">
            {specs.map((spec) => {
              const status = statusFor(spec.id);
              const missing = missingFor(spec.id);
              const installedCount = status ? Object.values(status).filter(Boolean).length : 0;
              const isOpen = open[spec.id] ?? false;
              const allKey = `${spec.id}::*`;
              return (
                <div key={spec.id} className="rounded-[3px] border border-[#2a302c] bg-[#080a09]">
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [spec.id]: !isOpen }))}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {isOpen ? <ChevronDown size={11} className="shrink-0 text-[#6f6a61]" /> : <ChevronRight size={11} className="shrink-0 text-[#6f6a61]" />}
                      <span className="truncate text-sm font-semibold text-[#f4f1e8]">{spec.name}</span>
                      {installedCount > 0 ? <Badge tone="green">installed × {installedCount}</Badge> : <Badge tone="gray">not installed</Badge>}
                      {missing.length > 0 ? <Badge tone="yellow">missing {missing.length} secret(s)</Badge> : null}
                    </div>
                    <span className="hidden truncate text-[0.66rem] text-[#6f6a61] sm:inline">{spec.description}</span>
                  </button>

                  {isOpen ? (
                    <div className="space-y-3 border-t border-[#2a302c] p-3">
                      <p className="text-[0.72rem] leading-5 text-[#a8a29a]">{spec.description}</p>
                      <div className="flex flex-wrap items-center gap-2 text-[0.6rem] text-[#6f6a61]">
                        <span className="font-mono">{spec.runtime === "node-local" ? "node " + spec.package : `${spec.runtime} ${spec.package}`}</span>
                        {spec.docsUrl ? (
                          <a href={spec.docsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#e86f3a] hover:underline">
                            docs <ExternalLink size={9} />
                          </a>
                        ) : null}
                      </div>

                      {missing.length > 0 ? (
                        <div className="rounded-[2px] border border-[#c99a45]/40 bg-[#c99a45]/10 p-2 text-[0.7rem] text-[#e0b96b]">
                          Missing credentials: <span className="font-mono">{missing.join(", ")}</span>. Add them in Integrations &amp;
                          Credentials above before installing — otherwise the server will boot but fail on every call.
                        </div>
                      ) : null}

                      <div>
                        <div className="mb-1 text-[0.58rem] uppercase tracking-[0.16em] text-[#6f6a61]">Exposed tools</div>
                        <div className="flex flex-wrap gap-1">
                          {spec.exposes.map((t) => (
                            <Badge key={t}>{t}</Badge>
                          ))}
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        {(["claude-code", "codex", "gemini-cli"] as CliTarget[]).map((target) => {
                          const installed = status?.[target] ?? false;
                          const k = `${spec.id}::${target}`;
                          return (
                            <div key={target} className="flex items-center justify-between rounded-[2px] border border-[#2a302c] bg-[#10120f] p-2">
                              <div>
                                <div className="text-[0.7rem] font-bold text-[#f4f1e8]">{TARGET_LABEL[target]}</div>
                                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-[#6f6a61]">
                                  {installed ? "installed" : "not installed"}
                                </div>
                              </div>
                              {installed ? (
                                <button
                                  type="button"
                                  onClick={() => uninstall(spec.id, target)}
                                  disabled={busy[k]}
                                  className="inline-flex h-6 items-center gap-1 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#d9827d] hover:border-[#d9827d] disabled:opacity-50"
                                >
                                  {busy[k] ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                                  Remove
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => install(spec.id, target)}
                                  disabled={busy[k]}
                                  className="inline-flex h-6 items-center gap-1 rounded-[2px] border border-[#e86f3a]/60 bg-[#1d1612] px-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#e86f3a] hover:bg-[#251914] disabled:opacity-50"
                                >
                                  {busy[k] ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
                                  Install
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          onClick={() => installAll(spec.id)}
                          disabled={busy[allKey]}
                          className="inline-flex h-7 items-center gap-2 rounded-[3px] border border-[#79a875]/40 bg-[#1c2620] px-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#9fc39b] hover:bg-[#243029] disabled:opacity-50"
                        >
                          {busy[allKey] ? <Loader2 size={11} className="animate-spin" /> : <CheckCircle2 size={11} />}
                          Install on every CLI
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

