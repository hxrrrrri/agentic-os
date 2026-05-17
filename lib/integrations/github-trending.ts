export interface RepoItem {
  rank: number;
  name: string;
  stars: string;
  ai?: boolean;
  description: string;
}

const TRENDING_URL = "https://github.com/trending";

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

export async function fetchGhTrending(limit = 5): Promise<RepoItem[] | null> {
  try {
    const res = await fetch(TRENDING_URL, {
      next: { revalidate: 1800 },
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 AgenticOS/0.1",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const repos: RepoItem[] = [];
    const blockRe = /<article[^>]*class="[^"]*Box-row[^"]*"[^>]*>([\s\S]*?)<\/article>/g;
    for (const match of html.matchAll(blockRe)) {
      if (repos.length >= limit) break;
      const block = match[1];

      const nameMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*href="\/([^"#]+)"/);
      if (!nameMatch) continue;
      const name = nameMatch[1].trim();

      const descMatch = block.match(/<p[^>]*class="[^"]*col-9[^"]*"[^>]*>([\s\S]*?)<\/p>/);
      const description = descMatch ? decodeEntities(stripTags(descMatch[1])) : "";

      const starsMatch = block.match(/svg-octicon-star[\s\S]*?<\/svg>([\s\S]*?)<\/a>/) ||
        block.match(/octicon-star[^>]*>[\s\S]*?<\/svg>\s*([\d,]+)/);
      const stars = starsMatch ? stripTags(starsMatch[1]) : "";

      const ai = /(\bai\b|\bagent\b|\bllm\b|\bgpt\b|\bclaude\b)/i.test(`${name} ${description}`);

      repos.push({
        rank: repos.length + 1,
        name,
        stars,
        ai,
        description,
      });
    }


    return repos.length ? repos : null;
  } catch {
    return null;
  }
}
