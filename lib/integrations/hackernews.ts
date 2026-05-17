export interface HnItem {
  rank: number;
  id: number;
  title: string;
  points: string;
  url?: string;
}

const TOP_URL = "https://hacker-news.firebaseio.com/v0/topstories.json";
const ITEM_URL = (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`;

interface HnStory {
  id: number;
  title?: string;
  score?: number;
  url?: string;
  type?: string;
}

export async function fetchHnTop(limit = 5): Promise<HnItem[] | null> {
  try {
    const res = await fetch(TOP_URL, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const ids = (await res.json()) as number[];
    const items = await Promise.all(
      ids.slice(0, limit * 2).map(async (id) => {
        try {
          const r = await fetch(ITEM_URL(id), { next: { revalidate: 600 } });
          if (!r.ok) return null;
          return (await r.json()) as HnStory;
        } catch {
          return null;
        }
      }),
    );
    return items
      .filter((it): it is HnStory => Boolean(it && it.title))
      .slice(0, limit)
      .map((it, i) => ({
        rank: i + 1,
        id: it.id,
        title: it.title ?? "",
        points: `${it.score ?? 0}↑`,
        url: it.url,
      }));
  } catch {
    return null;
  }
}
