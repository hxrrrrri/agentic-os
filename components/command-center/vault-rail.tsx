import Link from "next/link";
import { ChevronRight, FileText, Folder } from "lucide-react";

const folders = [
  "_archive-vault",
  "content",
  "daily-notes",
  "inbox",
  "ops",
  "projects",
  "raw",
  "system",
  "wiki",
] as const;

const files = [
  { name: "index", href: "/vault" },
  { name: "CLAUDE", href: "/vault?file=CLAUDE.md", active: true },
] as const;

export function VaultRail() {
  return (
    <aside className="flex h-full flex-col border-r border-[#2f2f2f] bg-[#242424]">
      <div className="flex items-center justify-between border-b border-[#303030] px-2 py-[6px] text-[0.5rem] uppercase tracking-[0.16em] text-[#7f7a73]">
        <span />
        <span className="text-[#3d4239]">⋯</span>
      </div>
      <nav className="flex-1 overflow-y-auto thin-scrollbar py-1">
        {folders.map((name) => (
          <Link
            key={name}
            href={{ pathname: "/vault", query: { path: name } }}
            className="flex w-full items-center gap-[5px] px-2 py-[3px] text-left text-[0.66rem] text-[#d1ccc4] transition hover:bg-[#303030] hover:text-[#fff7ea]"
          >
            <ChevronRight size={11} className="shrink-0 text-[#4d524a]" />
            <Folder size={11} className="shrink-0 text-[#d58b55]" strokeWidth={1.35} />
            <span className="truncate">{name}</span>
          </Link>
        ))}
        {files.map((file) => {
          const active = "active" in file && file.active;
          return (
            <Link
              key={file.name}
              href={file.href}
              className={`flex w-full items-center gap-[5px] px-2 py-[3px] text-left text-[0.66rem] transition hover:bg-[#303030] ${
                active
                  ? "bg-[#3a3a3a] text-[#f4f1e8]"
                  : "text-[#d1ccc4] hover:text-[#fff7ea]"
              }`}
            >
              <span className="w-[11px]" />
              <FileText
                size={12}
                className={`shrink-0 ${active ? "text-[#e97848]" : "text-[#d1ccc4]"}`}
                strokeWidth={1.4}
              />
              <span className="truncate">{file.name}</span>
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-[#303030] px-3 py-2 text-[0.6rem] uppercase tracking-[0.14em] text-[#f4f1e8]">
        <div className="flex items-center gap-2">
          <span className="text-[#e86f3a]">◆</span>
          <span>The Vault</span>
          <span className="ml-auto text-[#3d4239]">?</span>
          <span className="text-[#3d4239]">⚙</span>
        </div>
      </div>
    </aside>
  );
}
