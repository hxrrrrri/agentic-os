import { listRoutines, listRuns } from "@/lib/db/repositories";
import { fetchGhTrending, type RepoItem } from "@/lib/integrations/github-trending";
import { fetchHnTop, type HnItem } from "@/lib/integrations/hackernews";
import { fetchInstagramStats } from "@/lib/integrations/instagram";
import { fetchTikTokStats } from "@/lib/integrations/tiktok";
import { fetchYoutubeLatest, fetchYoutubeRecentVideos, fetchYoutubeStats } from "@/lib/integrations/youtube";
import { usageMetrics } from "@/lib/mock/metrics";
import { readTasks, type CcTask } from "@/lib/command-center/tasks";

export interface TokenBurnData {
  percent: number;
  used: string;
  max: string;
  projDelta: string;
  lastPullMinutes: number;
}

export interface SocialTileData {
  label: string;
  value: string;
  delta: string;
  deltaDir: "up" | "flat" | "down";
  brand: "youtube" | "instagram" | "tiktok";
  live: boolean;
}

export interface LatestUploadData {
  title: string;
  views: string;
  likes: string;
  comments: string;
  age: string;
}

export interface ScheduleSlot {
  time: string;
  label: string;
  routineId?: string;
  enabled?: boolean;
}

export interface WeeklyVideoStat {
  title: string;
  videoId: string;
  views: number;
  viewsDisplay: string;
  publishedAt: string;
  ageHours: number;
  tone: "hit" | "steady" | "climbing" | "miss";
  pctOfBaseline: number;
}

export interface WeeklyReviewData {
  dateRange: string;
  windowDays: number;
  baseline: number;
  videos: WeeklyVideoStat[];
  tally: { hit: number; steady: number; climbing: number; miss: number };
  bullets: string[];
  live: boolean;
}

export interface ActivityFeedItem {
  id: string;
  skill: string;
  status: "ok" | "working" | "issue";
  summary: string;
  age: string;
}

export interface CommandCenterData {
  tokenBurn: TokenBurnData;
  socialTiles: SocialTileData[];
  latestUpload: LatestUploadData;
  schedule: ScheduleSlot[];
  tasks: CcTask[];
  repos: RepoItem[];
  hnItems: HnItem[];
  weeklyReview: WeeklyReviewData;
  activity: ActivityFeedItem[];
}

const defaultSchedule: ScheduleSlot[] = [
  { time: "08:00", label: "Gym" },
  { time: "09:30", label: "Short-form video" },
  { time: "11:30", label: "Lunch" },
  { time: "12:30", label: "Long-form video edit" },
  { time: "15:30", label: "Buffer" },
  { time: "16:00", label: "Skool Email" },
  { time: "16:15", label: "Streaming / go live" },
  { time: "18:15", label: "Ops block 2" },
];

const defaultRepos: RepoItem[] = [
  { rank: 1, name: "FULU-Foundation/OrcaSlicer-bambulab", stars: "4,629", description: "" },
  { rank: 2, name: "Nightmare-Eclipse/YellowKey", stars: "2,363", description: "YellowKey Bitlocker Bypass Vulnerability" },
  { rank: 3, name: "huangserva/3DCellForge", stars: "2,058", ai: true, description: "AI-powered interactive 3D model generation, inspection, and presentation studio." },
  { rank: 4, name: "nexu-io/html-anything", stars: "1,936", ai: true, description: "The agentic HTML editor — your local AI agent writes the HTML, you ship it." },
  { rank: 5, name: "yetone/native-feel-skill", stars: "1,623", ai: true, description: "An Agent Skill for designing cross platform desktop apps that feel native — distille..." },
];

const defaultHn: HnItem[] = [
  { rank: 1, id: 0, title: "Project Gutenberg — keeps getting better", points: "631↑" },
  { rank: 2, id: 0, title: "WinCE64 — Windows CE 2.11 for NG4", points: "115↑" },
  { rank: 3, id: 0, title: "I believe there are entire companies right now under AI psychosis", points: "488↑" },
  { rank: 4, id: 0, title: "Clip Foundation", points: "152↑" },
  { rank: 5, id: 0, title: "A 0 click exploit chain for the Pixel 10", points: "913↑" },
];

void defaultRepos;
void defaultHn;

const defaultLatest: LatestUploadData = {
  title: "YouTube not connected",
  views: "-",
  likes: "-",
  comments: "-",
  age: "NO API KEY",
};

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`.replace(/\.00M$/, "M");
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`.replace(/\.0K$/, "K");
  return n.toLocaleString("en-US");
}

function ageString(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}H OLD`;
  const days = Math.floor(hours / 24);
  return `${days}D OLD`;
}

function extractTime(s: string): string | null {
  const m = s.match(/(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function deriveTokenBurn(runs: Awaited<ReturnType<typeof listRuns>>): TokenBurnData {
  const metrics = usageMetrics(runs);
  const used = metrics.fiveHour.used;
  const max = metrics.fiveHour.max;
  const percent = Math.round((used / max) * 100);
  return {
    percent,
    used: compact(used),
    max: compact(max),
    projDelta: `${percent > 50 ? "+" : "+"}${((percent / 100) * 1.5).toFixed(2)}% PROJ`,
    lastPullMinutes: 0,
  };
}

function deriveSocialTiles(
  yt: Awaited<ReturnType<typeof fetchYoutubeStats>>,
  ig: Awaited<ReturnType<typeof fetchInstagramStats>>,
  tt: Awaited<ReturnType<typeof fetchTikTokStats>>,
): SocialTileData[] {
  return [
    {
      label: "Youtube Subs",
      value: yt ? compact(yt.subs) : "-",
      delta: yt ? "live" : "not connected",
      deltaDir: "flat",
      brand: "youtube",
      live: Boolean(yt),
    },
    {
      label: "Youtube Views",
      value: yt ? compact(yt.views) : "-",
      delta: yt ? "live" : "not connected",
      deltaDir: "flat",
      brand: "youtube",
      live: Boolean(yt),
    },
    {
      label: "Instagram",
      value: ig ? compact(ig.followers) : "-",
      delta: ig ? "live" : "not connected",
      deltaDir: "flat",
      brand: "instagram",
      live: Boolean(ig),
    },
    {
      label: "TikTok",
      value: tt ? compact(tt.followers) : "-",
      delta: tt ? "live" : "not connected",
      deltaDir: "flat",
      brand: "tiktok",
      live: Boolean(tt),
    },
  ];
}

function deriveLatestUpload(latest: Awaited<ReturnType<typeof fetchYoutubeLatest>>): LatestUploadData {
  if (!latest) return defaultLatest;
  return {
    title: latest.title,
    views: compact(latest.views),
    likes: compact(latest.likes),
    comments: compact(latest.comments),
    age: ageString(latest.publishedAt),
  };
}

function deriveSchedule(routines: Awaited<ReturnType<typeof listRoutines>>): ScheduleSlot[] {
  const slots = routines
    .filter((r) => r.enabled)
    .map<ScheduleSlot | null>((r) => {
      const time = extractTime(r.schedule);
      if (!time) return null;
      return { time, label: r.name, routineId: r.id, enabled: r.enabled };
    })
    .filter((s): s is ScheduleSlot => Boolean(s))
    .sort((a, b) => a.time.localeCompare(b.time));
  return slots.length >= 4 ? slots : defaultSchedule;
}

const WINDOW_DAYS = 7;

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : ((s[m - 1]! + s[m]!) / 2);
}

function classifyTone(
  views: number,
  baseline: number,
  ageHours: number,
): WeeklyVideoStat["tone"] {
  if (baseline === 0) return "steady";
  const ratio = views / baseline;
  if (ageHours < 48 && ratio < 0.75) return "climbing";
  if (ratio >= 1.5) return "hit";
  if (ratio >= 0.75) return "steady";
  return "miss";
}

function deriveWeeklyReview(
  recent: Awaited<ReturnType<typeof fetchYoutubeRecentVideos>>,
): WeeklyReviewData {
  const MOCK: WeeklyReviewData = {
    dateRange: "not connected",
    windowDays: WINDOW_DAYS,
    baseline: 0,
    live: false,
    videos: [],
    tally: { hit: 0, steady: 0, climbing: 0, miss: 0 },
    bullets: [
      '**Top: "Claude Code Just Got a Dashboard" at 52.5K — 197% of baseline, clear Hit.**',
      'Weakest: "Claude Code Has Evolved" at 14.5K — 55% of baseline.',
      "Window: 3 uploads, 83.7K total views, 27.9K avg.",
      "1 Hit this window — consider repurposing top-performer into short-form.",
    ],
  };
  MOCK.bullets = ["Connect YOUTUBE_API_KEY and YOUTUBE_CHANNEL_ID to enable weekly upload review."];

  if (!recent?.length) return MOCK;

  const now = Date.now();
  const windowCutoff = now - WINDOW_DAYS * 86_400_000;

  // Use all recent for baseline, window-only for display
  const allViews = recent.map((v) => v.views).filter((v) => v > 0);
  const baseline = Math.round(median(allViews));

  const windowVideos = recent.filter(
    (v) => v.publishedAt && new Date(v.publishedAt).getTime() >= windowCutoff,
  );

  const videos: WeeklyVideoStat[] = windowVideos.map((v) => {
    const ageHours = Math.floor((now - new Date(v.publishedAt).getTime()) / 3_600_000);
    const tone = classifyTone(v.views, baseline, ageHours);
    return {
      title: v.title,
      videoId: v.videoId,
      views: v.views,
      viewsDisplay: compact(v.views),
      publishedAt: v.publishedAt,
      ageHours,
      tone,
      pctOfBaseline: baseline > 0 ? Math.round((v.views / baseline) * 100) : 0,
    };
  });

  const tally = videos.reduce(
    (acc, v) => { acc[v.tone]++; return acc; },
    { hit: 0, steady: 0, climbing: 0, miss: 0 },
  );

  // Deterministic bullets from data
  const byViews = [...videos].sort((a, b) => b.views - a.views);
  const top = byViews[0];
  const bot = byViews[byViews.length - 1];
  const totalViews = videos.reduce((s, v) => s + v.views, 0);
  const bullets: string[] = [];
  if (top) bullets.push(`**Top: "${top.title}" at ${top.viewsDisplay} — ${top.pctOfBaseline}% of baseline, ${top.tone} performance.**`);
  if (bot && bot !== top) bullets.push(`Weakest: "${bot.title}" at ${bot.viewsDisplay} — ${bot.pctOfBaseline}% of baseline.`);
  bullets.push(`Window: ${videos.length} upload${videos.length !== 1 ? "s" : ""}, ${compact(totalViews)} total views, ${compact(Math.round(totalViews / Math.max(1, videos.length)))} avg.`);
  if (tally.hit > 0) bullets.push(`${tally.hit} Hit${tally.hit > 1 ? "s" : ""} this window — repurpose top-performer into short-form.`);

  const startDate = new Date(windowCutoff).toISOString().slice(0, 10);
  const endDate = new Date().toISOString().slice(0, 10);

  return { dateRange: `${startDate} → ${endDate}`, windowDays: WINDOW_DAYS, baseline, videos: byViews.slice(0, 3), tally, bullets, live: true };
}

function relativeAge(iso: string): string {
  const diffMs = Math.max(0, Date.now() - new Date(iso).getTime());
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function deriveActivityFeed(runs: Awaited<ReturnType<typeof listRuns>>): ActivityFeedItem[] {
  return [...runs]
    .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    .slice(0, 8)
    .map((run) => {
      const skill = (run.selectedSkill ?? run.title).replaceAll("-", " ").toUpperCase();
      const status: ActivityFeedItem["status"] =
        run.status === "failed" || run.status === "cancelled"
          ? "issue"
          : run.status === "completed"
            ? "ok"
            : "working";
      const summary =
        run.status === "completed"
          ? run.finalOutput?.slice(0, 88) || "Run completed."
          : run.status === "failed"
            ? run.errors[0] || "Run failed."
            : run.status === "waiting_for_approval"
              ? "Waiting for approval."
              : `${run.status.replaceAll("_", " ")}...`;
      return {
        id: run.id,
        skill,
        status,
        summary,
        age: relativeAge(run.startedAt),
      };
    });
}

export async function getCommandCenterData(): Promise<CommandCenterData> {
  const [runs, routines, tasks, ytStats, ytLatest, ytRecent, igStats, ttStats, hn, gh] = await Promise.all([
    listRuns().catch(() => []),
    listRoutines().catch(() => []),
    readTasks().catch(() => [] as CcTask[]),
    fetchYoutubeStats().catch(() => null),
    fetchYoutubeLatest().catch(() => null),
    fetchYoutubeRecentVideos(20).catch(() => null),
    fetchInstagramStats().catch(() => null),
    fetchTikTokStats().catch(() => null),
    fetchHnTop(5).catch(() => null),
    fetchGhTrending(20).catch(() => null),
  ]);

  return {
    tokenBurn: deriveTokenBurn(runs),
    socialTiles: deriveSocialTiles(ytStats, igStats, ttStats),
    latestUpload: deriveLatestUpload(ytLatest),
    schedule: deriveSchedule(routines),
    tasks,
    repos: gh ?? [],
    hnItems: hn ?? [],
    weeklyReview: deriveWeeklyReview(ytRecent),
    activity: deriveActivityFeed(runs),
  };
}
