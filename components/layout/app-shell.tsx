import Link from "next/link";
import { BookOpen, Circle, Code2, DollarSign, FileText, FlaskConical, Folder, HardDrive, Inbox, LayoutDashboard, Mic, MonitorPlay, Plug, Radio, Settings, Shield, Sparkle, TrendingUp, Users, Workflow as WorkflowIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AgenticOsLogo } from "@/components/layout/agenticos-logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

const nav = [
  ["Claude Code", "/dashboard", Code2],
  ["Command Center", "/command-center", LayoutDashboard],
  ["Vault", "/vault", HardDrive],
  ["Daily Note", "/vault", FileText],
  ["Runs Folder", "/runs", Folder],
  ["Run Theater", "/run-theater", Radio],
  ["Drafts", "/vault?path=drafts", Sparkle],
  ["Inbox", "/inbox", Inbox],
  ["Workflows", "/workflows", WorkflowIcon],
  ["Recorder", "/recorder", MonitorPlay],
  ["Voice", "/voice", Mic],
  ["Connectors", "/connectors", Plug],
  ["Workspaces", "/workspaces", Users],
  ["Compliance", "/compliance", Shield],
  ["Skill Loop", "/skills/improve", TrendingUp],
  ["Governor", "/billing/governor", DollarSign],
  ["Billing", "/billing", DollarSign],
  ["Docs", "/docs", BookOpen],
  ["Tests", "/tests", FlaskConical],
  ["Settings", "/settings", Settings],
] as const;

export function AppShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  const frameClass = wide ? "app-frame app-frame-wide" : "app-frame";
  const headerPadding = "px-3 sm:px-5 md:px-6";
  const mainPadding = "px-3 pb-10 sm:px-5 md:px-6";

  return (
    <div className="app-chrome min-h-screen">
      <header className="pb-3 pt-6 sm:pt-10 md:pt-12">
        <div className={`${frameClass} ${headerPadding}`}>
          <div className="flex flex-wrap items-start justify-between gap-3 sm:gap-6">
            <Link href="/dashboard" className="flex items-center gap-3 sm:gap-4 transition hover:opacity-90">
              <AgenticOsLogo className="h-9 w-9 sm:h-12 sm:w-12" />
              <div className="text-[22px] sm:text-[28px] md:text-[34px] font-black leading-none tracking-[0.16em] text-[#f4f1e8]">
                AGENTIC<span className="text-[#e86f3a]">OS</span>
              </div>
            </Link>
            <div className="hidden pt-3 text-[0.78rem] uppercase tracking-[0.16em] text-[#8d877e] lg:block">
              Vault / The Vault / Plan / Max / Permission / Safe Actions
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-3 sm:mt-7 md:flex-row md:items-start md:justify-between md:gap-4">
            <nav className="-mx-1 flex flex-nowrap items-center gap-2 overflow-x-auto px-1 thin-scrollbar md:flex-1 md:flex-wrap md:overflow-visible">
              {nav.map(([label, href, Icon]) => (
                <Link
                  key={label}
                  href={href}
                  className="nav-pill inline-flex h-9 shrink-0 items-center gap-2 rounded-[3px] border border-[#333333] bg-[#151515] px-4 text-[0.78rem] font-bold uppercase tracking-[0.1em] text-[#f6efe5] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_0_0_1px_rgba(0,0,0,0.55)] hover:border-[#3f2820] hover:bg-[#1d1715] hover:text-[#e97848]"
                >
                  <Icon size={13} className="text-[#e97848]" />
                  {label}
                </Link>
              ))}
            </nav>
            <div className="flex h-9 shrink-0 items-center gap-2 self-start">
              <ThemeToggle />
              <Badge tone="green" className="h-9 gap-2 px-3 text-[0.78rem]">
                <Circle size={7} fill="currentColor" /> Idle
              </Badge>
            </div>
          </div>
        </div>
      </header>
      <main className={`${frameClass} ${mainPadding}`}>{children}</main>
    </div>
  );
}
