import Link from "next/link";
import { TerminalSquare } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const nav = [
  ["Claude Code", "/dashboard"],
  ["Vault", "/vault"],
  ["Daily Note", "/vault"],
  ["Runs Folder", "/runs"],
  ["Drafts", "/vault?path=drafts"],
];

const side = [
  ["Dashboard", "/dashboard"],
  ["Runs", "/runs"],
  ["Vault", "/vault"],
  ["Skills", "/skills"],
  ["Routines", "/routines"],
  ["Integrations", "/integrations"],
  ["Approvals", "/approvals"],
  ["Settings", "/settings"],
];

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-[#2a302c] bg-[#080a09]/92 backdrop-blur">
        <div className="flex h-14 items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-3">
            <span className="grid h-8 w-8 place-items-center border border-[#e86f3a] bg-[#141815] text-[#e86f3a]">
              <TerminalSquare size={17} />
            </span>
            <div>
              <div className="text-sm font-black tracking-[0.24em] text-[#f4f1e8]">AGENTICOS</div>
              <div className="terminal-label">local command layer</div>
            </div>
          </Link>
          <nav className="hidden items-center gap-2 lg:flex">
            {nav.map(([label, href]) => (
              <Link key={label} href={href} className="border border-[#2a302c] px-3 py-2 text-[0.65rem] uppercase tracking-[0.12em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]">
                {label}
              </Link>
            ))}
          </nav>
          <Badge tone="green">Idle</Badge>
        </div>
      </header>
      <div className="grid lg:grid-cols-[180px_1fr]">
        <aside className="hidden min-h-[calc(100vh-56px)] border-r border-[#2a302c] bg-[#0b0d0c]/70 p-3 lg:block">
          <div className="terminal-label mb-3">Navigation</div>
          <div className="space-y-1">
            {side.map(([label, href]) => (
              <Link key={label} href={href} className="block border border-transparent px-3 py-2 text-xs uppercase tracking-[0.08em] text-[#a8a29a] hover:border-[#2a302c] hover:bg-[#101311] hover:text-[#f4f1e8]">
                {label}
              </Link>
            ))}
          </div>
          <div className="mt-6 border border-[#2a302c] bg-[#101311] p-3">
            <div className="terminal-label">Model Mesh</div>
            <div className="mt-2 text-xs leading-5 text-[#a8a29a]">Claude Code · Codex · Ollama · OpenAI · OpenRouter · Gemini · Grok</div>
          </div>
        </aside>
        <main className="min-w-0 p-4 lg:p-5">{children}</main>
      </div>
    </div>
  );
}
