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
  const repoLive = repos !== defaultRepos;
  const hnLive = hnItems !== defaultHn;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PanelCard
          title="GitHub Trending"
          live={repoLive}
          right={<HeaderControls date={nowDate()} />}
        >
          <ul className="space-y-[10px]">
            {repos.map((r) => (
              <li key={`${r.rank}-${r.name}`} className="grid grid-cols-[18px_1fr] gap-2 text-[0.7rem]">
                <span className="text-right text-[#6f6a61] font-bold">{r.rank}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <a
                      href={`https://github.com/${r.name}`}
                      target="_blank"
                      rel="noreferrer"
                      className="truncate text-[#f4f1e8] font-bold transition hover:text-[#e86f3a]"
                    >
                      {r.name}
                    </a>
                    <span className="text-[#e86f3a]">★</span>
                    <span className="text-[#a8a29a]">{r.stars}</span>
                    {r.ai ? (
                      <span className="inline-flex h-[14px] items-center rounded-[2px] border border-[#e86f3a]/50 bg-[#e86f3a]/10 px-[5px] text-[0.5rem] font-bold tracking-[0.16em] text-[#e86f3a]">
                        AI
                      </span>
                    ) : null}
                  </div>
                  {r.description ? <div className="mt-[2px] truncate text-[0.66rem] text-[#8b857b]">{r.description}</div> : null}
                </div>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="Hacker News"
          live={hnLive}
          right={<span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#6f6a61]">{nowTime()}</span>}
        >
          <ul className="space-y-[10px]">
            {hnItems.map((h) => (
              <li key={`${h.rank}-${h.title}`} className="grid grid-cols-[18px_1fr_auto] items-baseline gap-2 text-[0.7rem]">
                <span className="text-right text-[#6f6a61] font-bold">{h.rank}</span>
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
                <span className="text-[0.6rem] text-[#79a875]">{h.points}</span>
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
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">{title}</span>
          <span
            className={`h-[5px] w-[5px] rounded-full ${live ? "animate-pulse bg-[#79a875] shadow-[0_0_5px_#79a875]" : "bg-[#6f6a61]"}`}
            title={live ? "live" : "fallback / cached"}
          />
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function HeaderControls({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-1">
      <Pill>Full /</Pill>
      <button type="button" className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]">
        <Play size={9} />
      </button>
      <button type="button" className="flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[#6f6a61] transition hover:border-[#e86f3a] hover:text-[#e86f3a]">
        <RotateCw size={9} />
      </button>
      <span className="ml-1 text-[0.56rem] uppercase tracking-[0.18em] text-[#6f6a61]">{date}</span>
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <button type="button" className="inline-flex h-5 items-center rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 text-[0.52rem] font-bold uppercase tracking-[0.16em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]">
      {children}
    </button>
  );
}

function MorningBrief() {
  const chips: { label: string; count: number; tone: "amber" | "gray" }[] = [
    { label: "Headlines", count: 3, tone: "amber" },
    { label: "Articles", count: 5, tone: "gray" },
    { label: "X Voices", count: 3, tone: "gray" },
    { label: "Repos", count: 3, tone: "gray" },
    { label: "Opps", count: 3, tone: "gray" },
  ];
  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">$ Morning Brief</span>
          <span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#6f6a61]">{nowDate()}</span>
          <div className="flex items-center gap-1">
            {chips.map((c) => (
              <span
                key={c.label}
                className={`inline-flex h-5 items-center gap-1 rounded-[2px] border px-2 text-[0.52rem] font-bold uppercase tracking-[0.14em] ${
                  c.tone === "amber"
                    ? "border-[#e86f3a]/40 bg-[#e86f3a]/10 text-[#e86f3a]"
                    : "border-[#2a302c] bg-[#10120f] text-[#a8a29a]"
                }`}
              >
                <span className={c.tone === "amber" ? "text-[#e86f3a]" : "text-[#f4f1e8]"}>{c.count}</span>
                {c.label}
              </span>
            ))}
          </div>
        </div>
        <Pill>Full /</Pill>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div>
          <div className="mb-2 text-[0.54rem] uppercase tracking-[0.2em] text-[#e86f3a]">$ Headlines</div>
          <ul className="space-y-2">
            {briefHeadlines.map((h, i) => (
              <li key={i} className="text-[0.7rem] leading-relaxed text-[#f4f1e8]">
                {h}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-[0.54rem] uppercase tracking-[0.2em] text-[#e86f3a]">
            YT Trending <ExternalLink size={9} className="text-[#6f6a61]" />
          </div>
          <div className="text-[0.7rem] leading-relaxed text-[#f4f1e8]">How Claude Code Works</div>
          <div className="mt-1 text-[0.6rem] text-[#8b857b]">Claude (official, 295K subs) · 146,372</div>
        </div>
      </div>
    </div>
  );
}
