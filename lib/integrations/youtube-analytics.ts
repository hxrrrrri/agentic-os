/**
 * YouTube Analytics scaffold. Uses an OAuth access token (not the public Data
 * API key). Acquire via the Google OAuth helper at lib/integrations/google-oauth.
 *
 * Required env var: YOUTUBE_ANALYTICS_TOKEN  (or pass token explicitly).
 */

import { getSecret } from "@/lib/secrets/store";

const API = "https://youtubeanalytics.googleapis.com/v2";

interface AnalyticsRow {
  [k: string]: string | number;
}

interface AnalyticsResponse {
  columnHeaders: Array<{ name: string; columnType: string; dataType: string }>;
  rows?: Array<Array<string | number>>;
}

async function call(p: string, token?: string): Promise<AnalyticsResponse> {
  const accessToken = token ?? (await getSecret("YOUTUBE_ANALYTICS_TOKEN"));
  if (!accessToken) throw new Error("YOUTUBE_ANALYTICS_TOKEN not set");
  const res = await fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`YouTube Analytics ${p} -> ${res.status}`);
  return res.json() as Promise<AnalyticsResponse>;
}

function asRows(response: AnalyticsResponse): AnalyticsRow[] {
  if (!response.rows) return [];
  const names = response.columnHeaders.map((h) => h.name);
  return response.rows.map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]])));
}

export async function audienceMix(channelId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "viewerPercentage",
    dimensions: "ageGroup,gender",
    sort: "gender,ageGroup",
  });
  return asRows(await call(`/reports?${params.toString()}`));
}

export async function trafficSources(channelId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    ids: `channel==${channelId}`,
    startDate,
    endDate,
    metrics: "views,estimatedMinutesWatched",
    dimensions: "insightTrafficSourceType",
    sort: "-views",
  });
  return asRows(await call(`/reports?${params.toString()}`));
}

export async function retentionCurve(videoId: string, startDate: string, endDate: string) {
  const params = new URLSearchParams({
    ids: `channel==MINE`,
    startDate,
    endDate,
    metrics: "audienceWatchRatio,relativeRetentionPerformance",
    dimensions: "elapsedVideoTimeRatio",
    filters: `video==${videoId}`,
    sort: "elapsedVideoTimeRatio",
  });
  return asRows(await call(`/reports?${params.toString()}`));
}
