import Link from "next/link";
import type { ActivityFeedItem } from "@/lib/command-center/data";

interface Props {
  items?: ActivityFeedItem[];
}

const fallback: ActivityFeedItem[] = [
  { id: "mock-1", skill: "METRICS-PULL", status: "ok", summary: "Pulled 4/4 sources ok", age: "1h ago" },
  { id: "mock-2", skill: "GITHUB-TRENDING", status: "ok", summary: "Wrote inbox/research/github-trending.md", age: "1h ago" },
  { id: "mock-3", skill: "YT-WEEK-REVIEW", status: "ok", summary: "Review written: 1 hit, 1 steady, 1 miss.", age: "2h ago" },
  { id: "mock-4", skill: "PLAN-TODAY", status: "working", summary: "Saved daily-notes/today.md", age: "2h ago" },
];

const statusLabel: Record<ActivityFeedItem["status"], string> = {
  ok: "✓",
  working: "•",
  issue: "!",
};

const statusClass: Record<ActivityFeedItem["status"], string> = {
  ok: "border-[#79a875]/45 bg-[#79a875]/10 text-[#79a875]",
  working: "border-[#c99a45]/45 bg-[#c99a45]/10 text-[#c99a45]",
  issue: "border-[#c4605a]/45 bg-[#c4605a]/10 text-[#c4605a]",
};

export function ActivityFeed({ items = fallback }: Props) {
  const rows = items.length ? items : fallback;
  return (
    <div className="cc-panel cc-panel-muted p-[16px_18px]">
      <div className="relative z-[1] mb-3 flex items-center justify-between">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[#b8b2aa]">Activity Feed</span>
        <span className="text-[0.72rem] uppercase tracking-[0.14em] text-[#8d877e]">{rows.length} runs</span>
      </div>

      <div className="relative z-[1] space-y-[9px]">
        {rows.map((item) => (
          <div key={item.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-[1px] border border-[#2a302c] bg-[#0d0f11] px-3 py-[8px]">
            <span className={`inline-flex h-7 items-center rounded-[2px] border px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] ${statusClass[item.status]}`}>
              {statusLabel[item.status]} {item.skill}
            </span>
            <span className="truncate text-[0.86rem] text-[#f4f1e8]">{item.summary}</span>
            <div className="flex items-center gap-1">
              <Link
                href={`/runs/${item.id}`}
                className="inline-flex h-7 items-center rounded-[2px] border border-[#2a302c] bg-[#10120f] px-3 text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a]"
              >
                log
              </Link>
              <span className="text-[0.72rem] uppercase tracking-[0.12em] text-[#8d877e]">{item.age}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
