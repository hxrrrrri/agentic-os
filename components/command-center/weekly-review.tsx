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

  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-[0.6rem] font-bold uppercase tracking-[0.18em] text-[#e86f3a]">$ YT Week Review</span>
          <span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#6f6a61]">{dateRange}</span>
          {live ? (
            <span className="h-[5px] w-[5px] rounded-full bg-[#79a875] shadow-[0_0_5px_#79a875] animate-pulse" title="live data" />
          ) : (
            <span className="h-[5px] w-[5px] rounded-full bg-[#6f6a61]" title="mock / no API key" />
          )}
        </div>
        <Link
          href="/runs?skill=weekly-review"
          className="inline-flex h-5 items-center rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 text-[0.52rem] font-bold uppercase tracking-[0.16em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
        >
          Full /
        </Link>
      </div>

      {bullets.length > 0 ? (
        <ul className="mt-3 space-y-[6px]">
          {bullets.map((b, i) => (
            <li key={i} className="grid grid-cols-[12px_1fr] gap-2 text-[0.7rem] leading-relaxed text-[#f4f1e8]">
              <span className="text-[#e86f3a]">·</span>
              <span dangerouslySetInnerHTML={{ __html: b.replaceAll(/\*\*(.+?)\*\*/g, '<strong class="text-[#f4f1e8] font-bold">$1</strong>') }} />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-4 flex items-center gap-2 text-[0.54rem] uppercase tracking-[0.18em] text-[#6f6a61]">
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
        <div className={`mt-3 grid gap-3`} style={{ gridTemplateColumns: `repeat(${videos.length}, 1fr)` }}>
          {videos.map((v) => {
            const heightPct = Math.max(8, Math.round((v.views / max) * 100));
            const color = TONE_COLOR[v.tone];
            return (
              <div key={v.videoId || v.title} className="flex flex-col">
                <div className="mb-1 text-[0.6rem] font-bold uppercase tracking-[0.16em] text-[#a8a29a]">
                  {v.viewsDisplay}
                </div>
                <div className="relative h-32 overflow-hidden rounded-[2px] bg-[#10120f]">
                  <div
                    className="absolute bottom-0 w-full transition-[height] duration-700"
                    style={{
                      height: `${heightPct}%`,
                      background: `linear-gradient(180deg, ${color}, ${color}66 70%, ${color}22)`,
                      boxShadow: `inset 0 0 18px ${color}50`,
                    }}
                  />
                </div>
                <div className="mt-2 truncate text-[0.6rem] text-[#8b857b]">{v.title}</div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mt-3 text-[0.66rem] text-[#6f6a61]">No uploads in this window.</div>
      )}
    </div>
  );
}
