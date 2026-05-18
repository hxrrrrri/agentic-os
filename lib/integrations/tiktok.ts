import { agenticosConfig } from "@/agenticos.config";
import { getSecret } from "@/lib/secrets/store";

export interface TikTokStats {
  followers: number;
  following: number;
  likes: number;
  videos: number;
}

interface TtResp {
  data?: {
    user?: {
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  };
}

async function tiktokToken() {
  return (await getSecret("TIKTOK_TOKEN")) ?? agenticosConfig.tiktokToken;
}

export async function fetchTikTokStats(): Promise<TikTokStats | null> {
  const token = await tiktokToken();
  if (!token) return null;
  try {
    const url = "https://open.tiktokapis.com/v2/user/info/?fields=follower_count,following_count,likes_count,video_count";
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as TtResp;
    const user = data.data?.user;
    if (!user) return null;
    return {
      followers: user.follower_count ?? 0,
      following: user.following_count ?? 0,
      likes: user.likes_count ?? 0,
      videos: user.video_count ?? 0,
    };
  } catch {
    return null;
  }
}

export interface TikTokVideo {
  id: string;
  title: string;
  shareUrl: string;
  createTime: number;
  duration?: number;
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
}

interface TtVideosResp {
  data?: {
    videos?: Array<{
      id?: string;
      title?: string;
      share_url?: string;
      create_time?: number;
      duration?: number;
      view_count?: number;
      like_count?: number;
      comment_count?: number;
      share_count?: number;
    }>;
  };
}

export async function fetchRecentVideos(limit = 10): Promise<TikTokVideo[]> {
  const token = await tiktokToken();
  if (!token) return [];
  try {
    const url = `https://open.tiktokapis.com/v2/video/list/?fields=id,title,share_url,create_time,duration,view_count,like_count,comment_count,share_count`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ max_count: Math.min(20, Math.max(1, limit)) }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as TtVideosResp;
    return (data.data?.videos ?? []).map((v) => ({
      id: v.id ?? "",
      title: v.title ?? "",
      shareUrl: v.share_url ?? "",
      createTime: v.create_time ?? 0,
      duration: v.duration,
      viewCount: v.view_count,
      likeCount: v.like_count,
      commentCount: v.comment_count,
      shareCount: v.share_count,
    }));
  } catch {
    return [];
  }
}
