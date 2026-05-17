import { NextResponse } from "next/server";
import fsp from "node:fs/promises";
import { z } from "zod";
import { resolveVaultPath } from "@/lib/vault/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STOPWORDS = new Set(["the","a","an","and","or","but","is","are","was","were","be","been","have","has","had","do","does","did","will","would","could","should","may","might","can","shall","to","of","in","on","at","for","from","by","with","this","that","it"]);

const CATEGORY_KEYWORDS: Array<[string, string[]]> = [
  ["ai-agents", ["agent","llm","anthropic","claude","gpt","openai","gemini","copilot","codex"]],
  ["rag", ["rag","retrieval","embedding","vector","chromadb","pinecone","weaviate"]],
  ["python", ["python","pip","pandas","numpy","pytorch","fastapi","django"]],
  ["typescript", ["typescript","tsx","react","nextjs","tailwind","vite"]],
  ["research", ["research","paper","study","analysis","experiment","hypothesis"]],
  ["content", ["youtube","video","script","short","hook","title","thumbnail","upload"]],
  ["obsidian", ["obsidian","vault","wikilink","backlink","zettelkasten"]],
  ["project", ["project","milestone","deadline","sprint","roadmap","launch"]],
  ["meeting", ["meeting","standup","call","sync","agenda","action-items"]],
  ["finance", ["revenue","mrr","arr","stripe","invoice","budget","expense"]],
];

function extractHeuristicTags(content: string): string[] {
  const tags = new Set<string>();

  // Existing #tags
  for (const m of content.matchAll(/#([\w-]{2,30})/g)) tags.add(m[1].toLowerCase());

  // H2 headings as slugs
  for (const m of content.matchAll(/^##\s+(.+)$/mg)) {
    const slug = m[1].toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 25);
    if (slug.length >= 3 && !STOPWORDS.has(slug)) tags.add(slug);
  }

  // Category detection
  const lower = content.toLowerCase();
  for (const [cat, kws] of CATEGORY_KEYWORDS) {
    if (kws.some((kw) => lower.includes(kw))) tags.add(cat);
  }

  return Array.from(tags).slice(0, 12);
}

function patchFrontmatter(content: string, newTags: string[]): string {
  const hasFm = content.startsWith("---");

  if (!hasFm) {
    const tagsBlock = `---\ntags:\n${newTags.map((t) => `  - ${t}`).join("\n")}\n---\n`;
    return `${tagsBlock}\n${content}`;
  }

  const end = content.indexOf("\n---", 3);
  if (end === -1) return content;
  const fm = content.slice(0, end);
  const rest = content.slice(end);

  if (/^tags:/m.test(fm)) {
    // replace existing tags block
    const patched = fm.replace(/^tags:[\s\S]*?(?=\n\w|\n---)/m, `tags:\n${newTags.map((t) => `  - ${t}`).join("\n")}\n`);
    return patched + rest;
  }

  // append tags before closing ---
  return `${fm}\ntags:\n${newTags.map((t) => `  - ${t}`).join("\n")}${rest}`;
}

const Schema = z.object({ path: z.string().min(1) });

export async function POST(request: Request) {
  try {
    const body = Schema.parse(await request.json());
    const fullPath = resolveVaultPath(body.path);
    const content = await fsp.readFile(fullPath, "utf8");
    const tags = extractHeuristicTags(content);
    if (!tags.length) return NextResponse.json({ ok: true, tags: [], message: "No tags detected" });
    const patched = patchFrontmatter(content, tags);
    await fsp.writeFile(fullPath, patched, "utf8");
    return NextResponse.json({ ok: true, tags });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Autotag failed" },
      { status: 400 },
    );
  }
}
