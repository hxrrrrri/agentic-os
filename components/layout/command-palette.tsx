"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";

const items = [
  ["Run Deep Research", "/dashboard?skill=deep-research"],
  ["Open Vault", "/vault"],
  ["View Runs", "/runs"],
  ["Approval Inbox", "/approvals"],
  ["Tool Permission Center", "/integrations"],
  ["Routines", "/routines"],
  ["Settings", "/settings"],
  ["Workflow Builder", "/dashboard?skill=workflow-builder"],
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
      }
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const filtered = useMemo(() => items.filter(([label]) => label.toLowerCase().includes(query.toLowerCase())), [query]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/70 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="terminal-panel mx-auto mt-20 max-w-xl bg-[#101311]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[#2a302c] p-3">
          <Search size={16} className="text-[#e86f3a]" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="w-full bg-transparent text-sm text-[#f4f1e8] outline-none" placeholder="search skills, files, routines, runs..." />
          <button onClick={() => setOpen(false)} className="text-[#6f6a61] hover:text-[#e86f3a]" aria-label="Close command palette">
            <X size={16} />
          </button>
        </div>
        <div className="p-2">
          {filtered.map(([label, href]) => (
            <Link key={label} href={href} onClick={() => setOpen(false)} className="block border border-transparent px-3 py-3 text-sm text-[#a8a29a] hover:border-[#e86f3a] hover:bg-[#141815] hover:text-[#f4f1e8]">
              {label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
