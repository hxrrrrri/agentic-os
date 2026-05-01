import Link from "next/link";
import { Circle, Code2, FileText, Folder, HardDrive, Sparkle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const nav = [
  ["Claude Code", "/dashboard", Code2],
  ["Vault", "/vault", HardDrive],
  ["Daily Note", "/vault", FileText],
  ["Runs Folder", "/runs", Folder],
  ["Drafts", "/vault?path=drafts", Sparkle],
] as const;

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="pb-3 pt-16">
        <div className="app-frame">
          <div className="flex items-start justify-between gap-6">
            <Link href="/dashboard" className="flex items-center gap-4">
              <span className="relative grid h-5 w-5 place-items-center bg-[#e86f3a] text-[9px] font-black text-[#080a09] shadow-[0_0_0_1px_#5f2b1a]">
                <span className="absolute -top-1 left-0 h-1 w-1 bg-[#e86f3a]" />
                <span className="absolute -top-1 right-0 h-1 w-1 bg-[#e86f3a]" />
                ::
              </span>
              <div className="text-[34px] font-black leading-none tracking-[0.16em] text-[#f4f1e8]">
                AGENTIC<span className="text-[#e86f3a]">OS</span>
              </div>
            </Link>
            <div className="hidden pt-3 text-[0.52rem] uppercase tracking-[0.2em] text-[#8b857b] md:block">
              Vault / The Vault / Plan / Max / Permission / Safe Actions
            </div>
          </div>
          <div className="mt-7 flex items-center justify-between gap-4">
            <nav className="flex flex-wrap items-center gap-2">
              {nav.map(([label, href, Icon]) => (
                <Link
                  key={label}
                  href={href}
                  className="inline-flex h-7 items-center gap-2 rounded-[3px] border border-[#30342c] bg-[#10120f] px-3 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-[#f4f1e8] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
                >
                  <Icon size={10} className="text-[#e86f3a]" />
                  {label}
                </Link>
              ))}
            </nav>
            <Badge tone="green" className="h-7 gap-2">
              <Circle size={7} fill="currentColor" /> Idle
            </Badge>
          </div>
        </div>
      </header>
      <main className="app-frame pb-10">{children}</main>
    </div>
  );
}
