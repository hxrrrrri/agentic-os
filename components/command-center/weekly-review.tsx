import Link from "next/link";
import type { WeeklyReviewData, WeeklyVideoStat } from "@/lib/command-center/data";

const TONE_COLOR: Record<WeeklyVideoStat["tone"], string> = {
  hit: "#79a875",
  steady: "#c99a45",
  climbing: "#5cb8e0",
  miss: "#e86f3a",
};

const TALLY_ORDER: Array<{ key: keyof WeeklyReviewData["tally"]; label: string; color: string }> = [
  { key: "hit", label: "Hit", color: "#79a875" },
  { key: "steady", label: "Steady", color: "#c99a45" },
  { key: "climbing", label: "Climbing", color: "#5cb8e0" },
  { key: "miss", label: "Miss", color: "#e86f3a" },
];

interface Props {
  data?: WeeklyReviewData | null;
}

export function WeeklyReview({ data }: Props) {
  const videos = data?.videos ?? [];
  const bullets = data?.bullets ?? [];
  const tally = data?.tally ?? { hit: 0, steady: 0, climbing: 0, miss: 0 };
  const dateRange = data?.dateRange ?? "—";
  const live = data?.live ?? false;
  const max = Math.max(...videos.map((v) => v.views), 1);
  const topPerformer = videos[0];
  const underperformer = [...videos].sort((a, b) => a.views - b.views)[0];

  return (
    <div className="cc-panel p-[16px_18px]">
      <div className="relative z-[1] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#e86f3a]">$ YT Week Review</span>
          <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">{dateRange}</span>
          {live ? (
            <span className="cc-live-dot h-[5px] w-[5px] rounded-full bg-[#79a875] shadow-[0_0_5px_#79a875]" title="live data" />
          ) : (
            <span className="h-[5px] w-[5px] rounded-full bg-[#6f6a61]" title="mock / no API key" />
          )}
        </div>
        <Link
          href="/runs?skill=weekly-review"
          className="inline-flex h-7 items-center rounded-[2px] border border-[#2a302c] bg-[#10120f] px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
        >
          Full /
        </Link>
      </div>

      {bullets.length > 0 ? (
        <ul className="relative z-[1] mt-3 space-y-[5px]">
          {bullets.map((b, i) => (
            <li key={i} className="grid grid-cols-[18px_1fr] gap-3 text-[0.88rem] leading-relaxed text-[#f4f1e8]">
              <span className="text-[#e86f3a]">·</span>
              <span dangerouslySetInnerHTML={{ __html: b.replaceAll(/\*\*(.+?)\*\*/g, '<strong class="text-[#f4f1e8] font-bold">$1</strong>') }} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="relative z-[1] mt-4 flex flex-wrap items-center gap-2 text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">
        <span>Uploads · Views</span>
        {TALLY_ORDER.map((t) => (
          <span
            key={t.key}
            className="inline-flex h-5 items-center gap-1 rounded-[2px] border px-2 font-bold"
            style={{ borderColor: `${t.color}40`, color: t.color, background: `${t.color}10` }}
          >
            {t.label}
            <span className="text-[#f4f1e8]">{tally[t.key]}</span>
          </span>
        ))}
      </div>

      {videos.length > 0 ? (
        <div className={`relative z-[1] mt-3 grid gap-3`} style={{ gridTemplateColumns: `repeat(${videos.length}, 1fr)` }}>
          {videos.map((v) => {
            const heightPct = Math.max(8, Math.round((v.views / max) * 100));
            const color = TONE_COLOR[v.tone];
            return (
              <div key={v.videoId || v.title} className="flex flex-col">
                <div className="mb-2 text-[0.76rem] font-bold uppercase tracking-[0.12em] text-[#b8b2aa]">
                  {v.viewsDisplay}
                </div>
                <div className="relative h-24 overflow-hidden rounded-[1px] bg-[#10120f]">
                  <div
                    className="absolute bottom-0 w-full transition-[height] duration-700"
                    style={{
                      height: `${heightPct}%`,
                      background: `linear-gradient(180deg, ${color}, ${color}66 70%, ${color}22)`,
                      boxShadow: `inset 0 0 18px ${color}50`,
                    }}
                  />
                </div>
                <div className="mt-2 truncate text-[0.78rem] text-[#8b857b]">{v.title}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="relative z-[1] mt-3 text-[0.88rem] text-[#8d877e]">No uploads in this window.</div>
      )}

      {topPerformer && underperformer ? (
        <div className="relative z-[1] mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-[2px] border border-[#79a875]/45 bg-[#0d1210] p-2">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#79a875]">▲ Top Performer</div>
            <div className="mt-2 text-[0.88rem] text-[#f4f1e8]">{topPerformer.title}</div>
            <div className="mt-2 text-[0.76rem] text-[#8b857b]">
              {topPerformer.viewsDisplay} views · {topPerformer.pctOfBaseline}% of baseline.
            </div>
          </div>
          <div className="rounded-[2px] border border-[#e86f3a]/40 bg-[#120d0d] p-2">
            <div className="text-[0.72rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a]">▼ Underperformer</div>
            <div className="mt-2 text-[0.88rem] text-[#f4f1e8]">{underperformer.title}</div>
            <div className="mt-2 text-[0.76rem] text-[#8b857b]">
              {underperformer.viewsDisplay} views · {underperformer.pctOfBaseline}% of baseline.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
