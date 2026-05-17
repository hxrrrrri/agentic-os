import fsp from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";

export interface PatternEntry {
  term: string;
  dayCount: number;
  totalOccurrences: number;
  frequency: number; // 0..1
  recentDays: string[];
}

const STOPWORDS = new Set([
  "the","a","an","and","or","but","is","are","was","were","be","been",
  "have","has","had","do","does","did","will","would","could","should",
  "may","might","can","shall","to","of","in","on","at","for","from",
  "by","with","this","that","these","those","it","he","she","they","we",
  "you","me","us","him","her","its","my","your","their","our","his","i",
  "not","no","so","up","out","then","also","more","than","into","about",
  "over","after","before","during","as","if","when","just","very","some",
  "any","all","one","two","three","get","got","let","new","see","use",
  "used","via","like","good","make","back","made","way","even","here",
  "there","now","then","well","much","many","other","same","each","both",
  "most","own","such","first","last","next","only","still","through",
  "while","note","notes","today","done","todo","task","tasks",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/\[{1,2}[^\]]*\]{1,2}/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

export async function detectPatterns(windowDays = 30, minFrequency = 0.25): Promise<PatternEntry[]> {
  const dailyDir = path.join(agenticosConfig.vaultPath, "daily");
  let entries;
  try {
    entries = await fsp.readdir(dailyDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const cutoff = Date.now() - windowDays * 86_400_000;
  const files = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => ({ name: e.name, full: path.join(dailyDir, e.name) }))
    .filter((f) => {
      const dateStr = f.name.slice(0, 10);
      return new Date(dateStr).getTime() >= cutoff;
    })
    .sort((a, b) => b.name.localeCompare(a.name));

  if (!files.length) return [];

  // Map: term → Set<dayLabel>
  const termDays = new Map<string, Set<string>>();
  const termCount = new Map<string, number>();

  for (const f of files) {
    const dayLabel = f.name.slice(0, 10);
    const content = await fsp.readFile(f.full, "utf8").catch(() => "");
    const words = tokenize(content);
    const dayTerms = new Set(words);

    for (const word of dayTerms) {
      if (!termDays.has(word)) termDays.set(word, new Set());
      termDays.get(word)!.add(dayLabel);
    }
    for (const word of words) {
      termCount.set(word, (termCount.get(word) ?? 0) + 1);
    }
  }

  const totalDays = files.length;
  const results: PatternEntry[] = [];

  for (const [term, days] of termDays.entries()) {
    const frequency = days.size / totalDays;
    if (frequency < minFrequency) continue;
    results.push({
      term,
      dayCount: days.size,
      totalOccurrences: termCount.get(term) ?? days.size,
      frequency,
      recentDays: Array.from(days).sort().reverse().slice(0, 5),
    });
  }

  return results
    .sort((a, b) => b.dayCount - a.dayCount || b.totalOccurrences - a.totalOccurrences)
    .slice(0, 25);
}
