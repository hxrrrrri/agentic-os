"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { FileText, Folder, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MarkdownOutput } from "@/components/ui/markdown-output";

interface DocEntry {
  id: string;
  title: string;
  group: string;
  bytes: number;
  updatedAt: string;
}

interface DocBody {
  ok: boolean;
  content?: string;
  title?: string;
  relativePath?: string;
  error?: string;
}

export function DocsViewer({ initialDocs }: { initialDocs: DocEntry[] }) {
  const [docs] = useState<DocEntry[]>(initialDocs);
  const [activeId, setActiveId] = useState<string | null>(initialDocs[0]?.id ?? null);
  const [body, setBody] = useState<DocBody | null>(null);
  const [loading, startLoading] = useTransition();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!activeId) return;
    const ac = new AbortController();
    startLoading(() => {
      fetch(`/api/docs/${encodeURIComponent(activeId)}`, { signal: ac.signal })
        .then((r) => r.json())
        .then((d: DocBody) => setBody(d))
        .catch(() => {
          if (!ac.signal.aborted) setBody({ ok: false, error: "Failed to load doc" });
        });
    });
    return () => ac.abort();
  }, [activeId]);

  const grouped = useMemo(() => {
    const filtered = query
      ? docs.filter(
          (d) =>
            d.title.toLowerCase().includes(query.toLowerCase()) ||
            d.id.toLowerCase().includes(query.toLowerCase()),
        )
      : docs;
    const map = new Map<string, DocEntry[]>();
    for (const d of filtered) {
      const list = map.get(d.group) ?? [];
      list.push(d);
      map.set(d.group, list);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "repo") return -1;
      if (b === "repo") return 1;
      return a.localeCompare(b);
    });
  }, [docs, query]);

  return (
    <div className="space-y-4">
      <div>
        <div className="terminal-label">Reference</div>
        <h1 className="mt-2 text-3xl font-black tracking-[0.12em]">DOCS</h1>
        <p className="mt-1 text-sm text-[#a8a29a]">
          Project rules, agent playbooks, skills, and audit reports — rendered live from the repo.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[280px_1fr]">
        <Card className="p-3">
          <div className="mb-2 flex items-center gap-2 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2">
            <Search size={11} className="text-[#6f6a61]" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter docs"
              className="h-7 flex-1 bg-transparent text-[0.72rem] text-[#f4f1e8] outline-none placeholder:text-[#6f6a61]"
            />
          </div>
          <nav className="max-h-[70vh] overflow-y-auto thin-scrollbar">
            {grouped.length === 0 ? (
              <p className="px-2 py-3 text-[0.7rem] text-[#6f6a61]">No docs found.</p>
            ) : (
              grouped.map(([group, items]) => (
                <div key={group} className="mb-2">
                  <div className="flex items-center gap-1 px-1 py-1 text-[0.52rem] uppercase tracking-[0.18em] text-[#6f6a61]">
                    <Folder size={9} />
                    {group}
                  </div>
                  <ul>
                    {items.map((d) => (
                      <li key={d.id}>
                        <button
                          type="button"
                          onClick={() => setActiveId(d.id)}
                          className={`flex w-full items-center gap-[6px] rounded-[2px] px-2 py-[3px] text-left text-[0.72rem] transition ${
                            d.id === activeId
                              ? "bg-[#1d1612] text-[#e86f3a]"
                              : "text-[#a8a29a] hover:bg-[#10120f] hover:text-[#f4f1e8]"
                          }`}
                        >
                          <FileText size={11} className="shrink-0 text-[#7d8273]" strokeWidth={1.4} />
                          <span className="truncate">{d.title}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </nav>
        </Card>

        <Card className="p-5">
          {!activeId ? (
            <p className="text-sm text-[#6f6a61]">Select a doc from the list.</p>
          ) : loading ? (
            <p className="text-sm text-[#6f6a61]">Loading…</p>
          ) : body?.ok && body.content ? (
            <div>
              <div className="mb-3 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.16em] text-[#6f6a61]">
                <span className="font-mono">{body.relativePath}</span>
                <span>{body.content.length.toLocaleString()} chars</span>
              </div>
              <article className="text-sm">
                <MarkdownOutput content={body.content} />
              </article>
            </div>
          ) : (
            <p className="text-sm text-[#e86f3a]">{body?.error ?? "Unable to load."}</p>
          )}
        </Card>
      </div>
    </div>
  );
}
