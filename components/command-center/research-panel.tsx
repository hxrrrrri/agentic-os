"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import Link from "next/link";
import { ExternalLink, Play, RotateCw } from "lucide-react";
import type { RepoItem } from "@/lib/integrations/github-trending";
import type { HnItem } from "@/lib/integrations/hackernews";

const defaultRepos: RepoItem[] = [
  { rank: 1, name: "FULU-Foundation/OrcaSlicer-bambulab", stars: "4,629", description: "" },
  { rank: 2, name: "Nightmare-Eclipse/YellowKey", stars: "2,363", description: "YellowKey Bitlocker Bypass Vulnerability" },
  { rank: 3, name: "huangserva/3DCellForge", stars: "2,058", ai: true, description: "AI-powered interactive 3D model generation, inspection, and presentation studio." },
  { rank: 4, name: "nexu-io/html-anything", stars: "1,936", ai: true, description: "✦ The agentic HTML editor — your local AI agent writes the HTML, you ship it." },
  { rank: 5, name: "yetone/native-feel-skill", stars: "1,623", ai: true, description: "An Agent Skill for designing cross platform desktop apps that feel native." },
];

const defaultHn: HnItem[] = [
  { rank: 1, id: 0, title: "Project Gutenberg — keeps getting better", points: "631↑" },
  { rank: 2, id: 0, title: "WinCE64 — Windows CE 2.11 for NG4", points: "115↑" },
  { rank: 3, id: 0, title: "I believe there are entire companies right now under AI psychosis", points: "488↑" },
  { rank: 4, id: 0, title: "Clip Foundation", points: "152↑" },
  { rank: 5, id: 0, title: "A 0 click exploit chain for the Pixel 10", points: "913↑" },
];

const briefHeadlines = [
  "xAI ships Grok Build today — Musk's first coding agent enters the ring to take on Claude Code, marking the most direct competitor entry of the year (Bloomberg).",
  "Anthropic announces enterprise pricing tier with expanded compliance posture and SOC2 Type II artifacts.",
  "Cursor 1.x cuts subscription pricing for the indie tier and bundles Claude Opus access by default.",
];

interface Props {
  repos?: RepoItem[];
  hnItems?: HnItem[];
}

function nowDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function nowTime(): string {
  return new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export function ResearchPanel({ repos = defaultRepos, hnItems = defaultHn }: Props) {
  const repoRows = repos.length ? repos : defaultRepos;
  const hnRows = hnItems.length ? hnItems : defaultHn;
  const repoLive = repos.length > 0;
  const hnLive = hnItems.length > 0;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const refresh = () => startTransition(() => router.refresh());

  return (
    <div className="space-y-[6px]">
      <div className="grid grid-cols-1 gap-[6px] lg:grid-cols-2">
        <PanelCard
          title="GitHub Trending"
          live={repoLive}
          right={<HeaderControls date={nowDate()} onRefresh={refresh} pending={pending} fullHref="/runs?skill=research" />}
        >
          <ul className="space-y-[4px] overflow-y-auto pr-1">
            {repoRows.map((r) => (
              <li key={`${r.rank}-${r.name}`} className="grid grid-cols-[24px_1fr] gap-3 border-l border-[#333333] px-3 py-[8px] text-[0.86rem] transition hover:bg-[#2a2a2a]">
                <span className="text-right font-bold text-[#e97848]">{r.rank}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${r.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate font-bold text-[#f4f1e8] transition hover:text-[#e86f3a]"
                    >
                      {r.name}
                    </a>
                    <span className="text-[#e86f3a]">★</span>
                    <span className="text-[#a8a29a]">{r.stars}</span>
                    {r.ai ? (
                      <span className="inline-flex h-5 items-center rounded-[2px] border border-[#e86f3a]/50 bg-[#e86f3a]/10 px-2 text-[0.66rem] font-bold tracking-[0.12em] text-[#e86f3a]">
                        AI
                      </span>
                    ) : null}
                  </div>
                  {r.description ? <div className="mt-[4px] truncate text-[0.76rem] text-[#8b857b]">{r.description}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="Hacker News"
          live={hnLive}
          right={
            <div className="flex items-center gap-1">
              <Pill href="https://news.ycombinator.com/">Full /</Pill>
              <button
                type="button"
                onClick={refresh}
                disabled={pending}
                aria-label="Refresh"
                className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2f3338] bg-[#101317] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-50"
              >
                <RotateCw size={9} className={pending ? "animate-spin" : undefined} />
              </button>
              <span className="ml-1 text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">{nowTime()}</span>
            </div>
          }
        >
          <ul className="space-y-[4px]">
            {hnRows.map((h) => (
              <li key={`${h.rank}-${h.title}`} className="grid grid-cols-[24px_1fr_auto] items-baseline gap-3 border-l border-[#333333] px-3 py-[8px] text-[0.86rem]">
                <span className="text-right font-bold text-[#e97848]">{h.rank}</span>
                {h.url ? (
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[#f4f1e8] transition hover:text-[#e86f3a]"
                  >
                    {h.title}
                  </a>
                ) : (
                  <a
                    href={h.id ? `https://news.ycombinator.com/item?id=${h.id}` : undefined}
                    target="_blank"
                    rel="noreferrer"
                    className="truncate text-[#f4f1e8] transition hover:text-[#e86f3a]"
                  >
                    {h.title}
                  </a>
                )}
                <span className="text-[0.78rem] text-[#79a875]">{h.points}</span>
              </li>
            ))}
          </ul>
        </PanelCard>
      </div>

      <MorningBrief />
    </div>
  );
}

function PanelCard({
  title,
  live,
  right,
  children,
}: {
  title: string;
  live?: boolean;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="cc-panel p-[10px_12px]">
      <div className="relative z-[1] mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#b8b2aa]">{title}</span>
          <span
            className={`h-[5px] w-[5px] rounded-full ${live ? "cc-live-dot bg-[#79a875] shadow-[0_0_5px_#79a875]" : "bg-[#6f6a61]"}`}
            title={live ? "live" : "fallback / cached"}
          />
        </div>
        {right}
      </div>
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}

function HeaderControls({
  date,
  onRefresh,
  pending,
  fullHref,
}: {
  date: string;
  onRefresh: () => void;
  pending: boolean;
  fullHref: string;
}) {
  return (
    <div className="flex items-center gap-1">
      <Pill href={fullHref}>Full /</Pill>
      <Link
        href={fullHref}
        className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2f3338] bg-[#101317] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
        aria-label="Open detail"
      >
        <Play size={9} />
      </Link>
      <button
        type="button"
        onClick={onRefresh}
        disabled={pending}
        aria-label="Refresh"
        className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2f3338] bg-[#101317] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-50"
      >
        <RotateCw size={9} className={pending ? "animate-spin" : undefined} />
      </button>
      <span className="ml-1 text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">{date}</span>
    </div>
  );
}

function Pill({ children, href }: { children: React.ReactNode; href?: string }) {
  const cls =
    "inline-flex h-7 items-center rounded-[1px] border border-[#4a4a4a] bg-[#2b2b2b] px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#d7d1c7] transition hover:border-[#e86f3a] hover:text-[#e86f3a]";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls}>
      {children}
    </button>
  );
}

function MorningBrief() {
  const chips: { label: string; count: number; tone: "amber" | "gray"; anchor: string }[] = [
    { label: "Headlines", count: 3, tone: "amber", anchor: "headlines" },
    { label: "Articles", count: 5, tone: "gray", anchor: "headlines" },
    { label: "X Voices", count: 3, tone: "gray", anchor: "headlines" },
    { label: "Repos", count: 3, tone: "gray", anchor: "headlines" },
    { label: "Opps", count: 3, tone: "gray", anchor: "headlines" },
  ];
  const ytTrending = [
    "How Claude Code Works",
    "Claude Code for Beginners [Full Course]",
    "Claude Code Tutorial: Beginner to Advanced in 20 Min",
  ];
  const conversation = [
    "Mood: Excited but watchful — community split between 'limits doubled' and concern about lock-in.",
    "Top voices: @claudeai, @shcremy, @catwu.",
    "Hot takes: first credible regression complaint from heavy power users.",
  ];
  const opportunities = [
    "I tried Grok Build vs Claude Code — here's the truth",
    "Anthropic just split your Claude subscription — what to do before June 15",
    "Why your Claude Code feels worse this week",
  ];
  return (
    <div className="cc-panel p-[10px_12px]">
      <div className="relative z-[1] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#e86f3a]">$ Morning Brief</span>
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">{nowDate()}</span>
          <div className="flex items-center gap-1">
            {chips.map((c) => (
              <a
                key={c.label}
                href={`#${c.anchor}`}
                className={`inline-flex h-7 items-center gap-1 rounded-[2px] border px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] transition hover:border-[#e86f3a] ${
                  c.tone === "amber"
                    ? "border-[#e86f3a]/40 bg-[#e86f3a]/10 text-[#e86f3a]"
                    : "border-[#2f3338] bg-[#101317] text-[#a8a29a]"
                }`}
              >
                <span className={c.tone === "amber" ? "text-[#e86f3a]" : "text-[#f4f1e8]"}>{c.count}</span>
                {c.label}
              </a>
            ))}
          </div>
        </div>
        <Pill href="/runs?skill=morning-brief">Full /</Pill>
      </div>

      <div id="headlines" className="relative z-[1] mt-3 grid grid-cols-1 gap-[6px] lg:grid-cols-2">
        <div className="rounded-[1px] border border-[#2a302c] bg-[#0c0e10] p-3">
          <div className="mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-[#b8b2aa]">• Headlines</div>
          <ul className="space-y-2">
            {briefHeadlines.map((h, i) => (
              <li key={i} className="text-[0.88rem] leading-relaxed text-[#f4f1e8]">
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1px] border border-[#5a1818]/55 bg-[#110d10] p-3">
          <div className="mb-3 flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-[#e86f3a]">
            ▶ YT Trending <ExternalLink size={9} className="text-[#6f6a61]" />
          </div>
          <ul className="space-y-2">
            {ytTrending.map((item) => (
              <li key={item} className="text-[0.88rem] leading-relaxed text-[#f4f1e8]">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1px] border border-[#2a302c] bg-[#0c0e10] p-3">
          <div className="mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-[#b8b2aa]">Σ Conversation</div>
          <ul className="space-y-2">
            {conversation.map((item) => (
              <li key={item} className="text-[0.88rem] leading-relaxed text-[#f4f1e8]">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-[1px] border border-[#5a1818]/55 bg-[#110d10] p-3">
          <div className="mb-3 text-[0.72rem] uppercase tracking-[0.16em] text-[#e86f3a]">★ Content Opportunities</div>
          <ol className="space-y-2">
            {opportunities.map((item, idx) => (
              <li key={item} className="grid grid-cols-[20px_1fr] gap-3 text-[0.88rem] leading-relaxed text-[#f4f1e8]">
                <span className="text-[#e86f3a]">{idx + 1}</span>
                <span>{item}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
