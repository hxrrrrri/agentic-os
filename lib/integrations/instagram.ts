import { agenticosConfig } from "@/agenticos.config";

export interface InstagramStats {
  followers: number;
  follows: number;
  mediaCount: number;
}

interface IgResp {
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
}

export async function fetchInstagramStats(): Promise<InstagramStats | null> {
  const token = agenticosConfig.instagramToken;
  const accountId = agenticosConfig.instagramAccountId;
  if (!token || !accountId) return null;
  try {
    const url = `https://graph.facebook.com/v18.0/${accountId}?fields=followers_count,follows_count,media_count&access_token=${token}`;
    const res = await fetch(url, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const data = (await res.json()) as IgResp;
    return {
      followers: data.followers_count ?? 0,
      follows: data.follows_count ?? 0,
      mediaCount: data.media_count ?? 0,
    };
  } catch {
    return null;
  }
}
