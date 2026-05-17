import { agenticosConfig } from "@/agenticos.config";

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

export async function fetchTikTokStats(): Promise<TikTokStats | null> {
  const token = agenticosConfig.tiktokToken;
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
