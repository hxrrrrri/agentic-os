import { agenticosConfig } from "@/agenticos.config";
import { getSecret } from "@/lib/secrets/store";

export interface InstagramStats {
  followers: number;
  follows: number;
  mediaCount: number;
  error?: string;
}

interface IgResp {
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  error?: { message?: string; code?: number; error_subcode?: number };
}

async function igCreds() {
  const token = (await getSecret("INSTAGRAM_TOKEN")) ?? agenticosConfig.instagramToken;
  const accountId = (await getSecret("INSTAGRAM_ACCOUNT_ID")) ?? agenticosConfig.instagramAccountId;
  return { token, accountId };
}

export async function fetchInstagramStats(): Promise<InstagramStats | null> {
  const { token, accountId } = await igCreds();
  if (!token || !accountId) return null;
  try {
    const url = `https://graph.facebook.com/v19.0/${accountId}?fields=followers_count,follows_count,media_count&access_token=${token}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    const data = (await res.json()) as IgResp;
    if (!res.ok || data.error) {
      const msg = data.error?.message ?? `HTTP ${res.status}`;
      const expired = data.error?.code === 190 || /expired|session/i.test(msg);
      console.warn(`[instagram] fetchStats failed: ${msg}`);
      return {
        followers: 0,
        follows: 0,
        mediaCount: 0,
        error: expired ? "token expired" : msg.slice(0, 80),
      };
    }
    return {
      followers: data.followers_count ?? 0,
      follows: data.follows_count ?? 0,
      mediaCount: data.media_count ?? 0,
    };
  } catch (e) {
    console.warn(`[instagram] fetchStats threw:`, e);
    return null;
  }
}

export interface InstagramMediaItem {
  id: string;
  caption: string;
  mediaType: string;
  permalink: string;
  timestamp: string;
  likeCount?: number;
  commentsCount?: number;
}

export interface InstagramCommentSummary {
  totalPosts: number;
  totalComments: number;
  posts: Array<{
    id: string;
    caption: string;
    permalink: string;
    timestamp: string;
    commentsCount: number;
  }>;
}

interface IgMediaResp {
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
}

export async function fetchRecentMedia(limit = 12): Promise<InstagramMediaItem[]> {
  const { token, accountId } = await igCreds();
  if (!token || !accountId) return [];
  try {
    const fields = "id,caption,media_type,permalink,timestamp,like_count,comments_count";
    const url = `https://graph.facebook.com/v19.0/${accountId}/media?fields=${fields}&limit=${limit}&access_token=${token}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return [];
    const data = (await res.json()) as IgMediaResp;
    return (data.data ?? []).map((m) => ({
      id: m.id,
      caption: m.caption ?? "",
      mediaType: m.media_type ?? "",
      permalink: m.permalink ?? "",
      timestamp: m.timestamp ?? "",
      likeCount: m.like_count,
      commentsCount: m.comments_count,
    }));
  } catch {
    return [];
  }
}

export async function fetchCommentSummary(limit = 12): Promise<InstagramCommentSummary> {
  const media = await fetchRecentMedia(limit);
  const posts = media.map((m) => ({
    id: m.id,
    caption: m.caption,
    permalink: m.permalink,
    timestamp: m.timestamp,
    commentsCount: m.commentsCount ?? 0,
  }));

  return {
    totalPosts: posts.length,
    totalComments: posts.reduce((sum, post) => sum + post.commentsCount, 0),
    posts,
  };
}
