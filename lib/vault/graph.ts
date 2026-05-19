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

async function walkAttachments(dir: string, out: string[]): Promise<void> {
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
      await walkAttachments(full, out);
    } else if (!entry.name.endsWith(".md")) {
      out.push(full);
    }
  }
}

function inferRunId(rel: string): string | undefined {
  // Artifact paths follow: attachments/<runId>/<file> or attachments/.../<runId>__<name>
  const segments = rel.split("/");
  for (const seg of segments) {
    if (/^run[_-]?[a-z0-9]{6,}$/i.test(seg)) return seg;
  }
  return undefined;
}

async function readAttachmentNode(root: string, full: string): Promise<VaultNode | null> {
  const rel = path.relative(root, full).replaceAll("\\", "/");
  if (!rel) return null;
  const stat = await fsp.stat(full).catch(() => null);
  if (!stat) return null;
  const linkedFromRunId = inferRunId(rel);
  const titleBase = path.basename(full, path.extname(full));
  const title = linkedFromRunId ? `${titleBase} (${linkedFromRunId})` : titleBase;
  return {
    path: rel,
    title,
    folder: rel.split("/")[0] ?? "attachments",
    // Use size-bytes as a proxy "weight" — attachments have no word count.
    wordCount: stat.size,
    // Leaf nodes: 0 outgoing wiki links by definition. backlink_count is
    // updated by the normal updateBacklinkCounts pass against vault_links.
    linkCount: 0,
    lastIndexed: nowIso(),
    exists: true,
  };
}

// Bounded parallelism — too high blocks the event loop; too low takes forever
// on large vaults. 8 strikes a good balance for SSD-backed file systems and
// keeps memory usage stable since each worker holds at most one file in flight.
const INDEX_CONCURRENCY = 8;

async function readNode(root: string, full: string): Promise<{ node: VaultNode; outLinks: Array<{ source: string; target: string }> }> {
  const rel = path.relative(root, full).replaceAll("\\", "/");
  const content = await fsp.readFile(full, "utf8").catch(() => "");
  const h1 = content.match(/^#\s+(.+)$/m);
  const title = h1 ? h1[1].trim() : path.basename(full, ".md");
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  const wikiLinks = extractWikiLinks(content);
  const outLinks = wikiLinks.map((target) => ({ source: rel, target }));
  return {
    node: {
      path: rel,
      title,
      folder: rel.split("/")[0] ?? "root",
      wordCount,
      linkCount: wikiLinks.length,
      lastIndexed: nowIso(),
      exists: true,
    },
    outLinks,
  };
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

    // Process the queue with a sliding window of N concurrent readers. Yields
    // back to the event loop between batches so request handlers stay snappy.
    let cursor = 0;
    async function worker() {
      while (cursor < mdFiles.length) {
        const idx = cursor++;
        try {
          const { node, outLinks } = await readNode(root, mdFiles[idx]);
          nodes.push(node);
          for (const link of outLinks) links.push(link);
        } catch {
          // Swallow per-file errors so the whole indexer doesn't die on a
          // single malformed file.
        }
      }
    }
    const workerCount = Math.min(INDEX_CONCURRENCY, Math.max(1, mdFiles.length));
    await Promise.all(Array.from({ length: workerCount }, worker));

    // Add attachments as leaf nodes. Skipped by walkMd because the indexer
    // only emits .md, but the user still wants graph stats to reflect the
    // total knowledge surface (carousels, generated images, etc.).
    const attachmentsRoot = path.join(root, "attachments");
    const attachmentFiles: string[] = [];
    await walkAttachments(attachmentsRoot, attachmentFiles);
    for (const att of attachmentFiles) {
      const node = await readAttachmentNode(root, att);
      if (node) nodes.push(node);
    }

    await batchUpsertVaultGraph({ nodes, links });
    return { nodes: nodes.length, links: links.length };
  } finally {
    indexRunning = false;
  }
}
