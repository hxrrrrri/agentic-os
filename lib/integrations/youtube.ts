import { agenticosConfig } from "@/agenticos.config";

export interface YoutubeStats {
  subs: number;
  views: number;
  videoCount: number;
}

export interface YoutubeLatest {
  title: string;
  views: number;
  likes: number;
  comments: number;
  publishedAt: string;
  videoId: string;
}

interface ChannelResp {
  items?: Array<{
    statistics?: { subscriberCount?: string; viewCount?: string; videoCount?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface PlaylistResp {
  items?: Array<{ contentDetails?: { videoId?: string } }>;
}

interface VideoResp {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; publishedAt?: string };
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

export interface YtVideoRecord {
  videoId: string;
  title: string;
  publishedAt: string;
  views: number;
  likes: number;
}

export async function fetchYoutubeStats(): Promise<YoutubeStats | null> {
  const key = agenticosConfig.youtubeApiKey;
  const channelId = agenticosConfig.youtubeChannelId;
  if (!key || !channelId) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${key}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as ChannelResp;
    const stats = data.items?.[0]?.statistics;
    if (!stats) return null;
    return {
      subs: Number(stats.subscriberCount ?? 0),
      views: Number(stats.viewCount ?? 0),
      videoCount: Number(stats.videoCount ?? 0),
    };
  } catch {
    return null;
  }
}

export async function fetchYoutubeRecentVideos(limit = 20): Promise<YtVideoRecord[] | null> {
  const key = agenticosConfig.youtubeApiKey;
  const channelId = agenticosConfig.youtubeChannelId;
  if (!key || !channelId) return null;
  try {
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${key}`,
      { next: { revalidate: 3600 } },
    );
    if (!chRes.ok) return null;
    const chData = (await chRes.json()) as ChannelResp;
    const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return null;

    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=${Math.min(50, limit)}&key=${key}`,
      { next: { revalidate: 300 } },
    );
    if (!plRes.ok) return null;
    const plData = (await plRes.json()) as PlaylistResp;
    const videoIds = (plData.items ?? [])
      .map((i) => i.contentDetails?.videoId)
      .filter((id): id is string => Boolean(id));
    if (!videoIds.length) return null;

    const vidRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoIds.join(",")}&part=id,snippet,statistics&key=${key}`,
      { next: { revalidate: 300 } },
    );
    if (!vidRes.ok) return null;
    const vidData = (await vidRes.json()) as VideoResp;

    return (vidData.items ?? []).map((v) => ({
      videoId: v.id ?? "",
      title: v.snippet?.title ?? "",
      publishedAt: v.snippet?.publishedAt ?? "",
      views: Number(v.statistics?.viewCount ?? 0),
      likes: Number(v.statistics?.likeCount ?? 0),
    }));
  } catch {
    return null;
  }
}

export async function fetchYoutubeLatest(): Promise<YoutubeLatest | null> {
  const key = agenticosConfig.youtubeApiKey;
  const channelId = agenticosConfig.youtubeChannelId;
  if (!key || !channelId) return null;
  try {
    const chRes = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${channelId}&key=${key}`,
      { next: { revalidate: 3600 } },
    );
    if (!chRes.ok) return null;
    const chData = (await chRes.json()) as ChannelResp;
    const uploads = chData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploads) return null;

    const plRes = await fetch(
      `https://www.googleapis.com/youtube/v3/playlistItems?part=contentDetails&playlistId=${uploads}&maxResults=1&key=${key}`,
      { next: { revalidate: 600 } },
    );
    if (!plRes.ok) return null;
    const plData = (await plRes.json()) as PlaylistResp;
    const videoId = plData.items?.[0]?.contentDetails?.videoId;
    if (!videoId) return null;

    const vidRes = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${key}`,
      { next: { revalidate: 600 } },
    );
    if (!vidRes.ok) return null;
    const vidData = (await vidRes.json()) as VideoResp;
    const video = vidData.items?.[0];
    if (!video) return null;

    return {
      videoId,
      title: video.snippet?.title ?? "",
      publishedAt: video.snippet?.publishedAt ?? "",
      views: Number(video.statistics?.viewCount ?? 0),
      likes: Number(video.statistics?.likeCount ?? 0),
      comments: Number(video.statistics?.commentCount ?? 0),
    };
  } catch {
    return null;
  }
}
