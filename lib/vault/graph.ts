import fsp from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import { nowIso } from "@/lib/utils";
import { extractWikiLinks } from "@/lib/vault/service";
import { batchUpsertVaultGraph, type VaultNode } from "@/lib/db/repositories";

let indexRunning = false;

async function walkMd(dir: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMd(full, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
}

export async function indexVaultGraph(): Promise<{ nodes: number; links: number }> {
  if (indexRunning) return { nodes: 0, links: 0 };
  indexRunning = true;
  try {
    const root = agenticosConfig.vaultPath;
    const mdFiles: string[] = [];
    await walkMd(root, mdFiles);

    const nodes: VaultNode[] = [];
    const links: Array<{ source: string; target: string }> = [];

    for (const full of mdFiles) {
      const rel = path.relative(root, full).replaceAll("\\", "/");
      const content = await fsp.readFile(full, "utf8").catch(() => "");
      const h1 = content.match(/^#\s+(.+)$/m);
      const title = h1 ? h1[1].trim() : path.basename(full, ".md");
      const wordCount = content.split(/\s+/).filter(Boolean).length;
      const wikiLinks = extractWikiLinks(content);
      nodes.push({ path: rel, title, folder: rel.split("/")[0] ?? "root", wordCount, linkCount: wikiLinks.length, lastIndexed: nowIso(), exists: true });
      for (const target of wikiLinks) links.push({ source: rel, target });
    }

    await batchUpsertVaultGraph({ nodes, links });
    return { nodes: nodes.length, links: links.length };
  } finally {
    indexRunning = false;
  }
}
