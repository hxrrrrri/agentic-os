import fs from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import type { VaultFile } from "@/types";
import { nowIso, slugify } from "@/lib/utils";

export const vaultFolders = [
  "raw",
  "wiki",
  "projects",
  "content",
  "daily",
  "runs",
  "drafts",
  "memory",
  "config",
  "attachments",
] as const;

export async function ensureVault() {
  await fs.mkdir(agenticosConfig.vaultPath, { recursive: true });
  await Promise.all(
    vaultFolders.map((folder) => fs.mkdir(path.join(agenticosConfig.vaultPath, folder), { recursive: true })),
  );
  await ensureObsidianConfig();
  return agenticosConfig.vaultPath;
}

async function ensureObsidianConfig() {
  const obsidianDir = path.join(agenticosConfig.vaultPath, ".obsidian");
  try {
    await fs.access(obsidianDir);
    return;
  } catch {}
  await fs.mkdir(obsidianDir, { recursive: true });
  const appConfig = {
    showLineNumber: true,
    defaultViewMode: "source",
    livePreview: true,
    foldHeading: true,
    foldIndent: true,
  };
  const corePlugins = ["file-explorer", "global-search", "graph", "backlink", "tag-pane", "daily-notes"];
  const dailyNotesConfig = {
    folder: "daily",
    format: "YYYY-MM-DD",
    template: "",
  };
  await Promise.all([
    fs.writeFile(path.join(obsidianDir, "app.json"), JSON.stringify(appConfig, null, 2)),
    fs.writeFile(path.join(obsidianDir, "core-plugins.json"), JSON.stringify(corePlugins, null, 2)),
    fs.writeFile(path.join(obsidianDir, "daily-notes.json"), JSON.stringify(dailyNotesConfig, null, 2)),
  ]);
}

export function resolveVaultPath(relativePath = "") {
  const root = path.resolve(agenticosConfig.vaultPath);
  const hasLeadingSlash = /^[/\\]+/.test(relativePath);
  const cleaned = relativePath.replace(/^[/\\]+/, "");
  if (path.isAbsolute(cleaned)) {
    throw new Error("Refusing to access absolute path outside vault");
  }
  if (hasLeadingSlash && cleaned) {
    const [topLevel] = cleaned.split(/[\\/]+/);
    if (!vaultFolders.includes(topLevel as (typeof vaultFolders)[number])) {
      throw new Error("Refusing to access absolute path outside vault");
    }
  }
  const target = path.resolve(root, cleaned);
  const rel = path.relative(root, target);
  if (rel === "" ) return target;
  if (rel.startsWith("..") || path.isAbsolute(rel)) {
    throw new Error("Refusing to access path outside vault");
  }
  return target;
}

export async function listVaultFiles(relativePath = "", limit = 80): Promise<VaultFile[]> {
  await ensureVault();
  const target = resolveVaultPath(relativePath);
  const entries = await fs.readdir(target, { withFileTypes: true });
  const visible = entries.filter((entry) => !entry.name.startsWith("."));
  const files = await Promise.all(
    visible.slice(0, limit).map(async (entry) => {
      const fullPath = path.join(target, entry.name);
      const stat = await fs.stat(fullPath);
      const rel = path.relative(agenticosConfig.vaultPath, fullPath).replaceAll("\\", "/");
      return {
        path: rel,
        name: entry.name,
        type: entry.isDirectory() ? ("directory" as const) : ("file" as const),
        size: stat.size,
        updatedAt: stat.mtime.toISOString(),
        status: "indexed" as const,
      };
    }),
  );
  return files.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export async function getRecentVaultFiles(limit = 8): Promise<VaultFile[]> {
  await ensureVault();
  const results: VaultFile[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith(".")) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          return;
        }
        const stat = await fs.stat(fullPath);
        results.push({
          path: path.relative(agenticosConfig.vaultPath, fullPath).replaceAll("\\", "/"),
          name: entry.name,
          type: "file",
          size: stat.size,
          updatedAt: stat.mtime.toISOString(),
          status: "updated",
        });
      }),
    );
  }

  await walk(agenticosConfig.vaultPath);
  return results.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt)).slice(0, limit);
}

export interface VaultContextEntry {
  path: string;
  updatedAt: string;
  content: string;
  truncated: boolean;
}

export interface VaultContextSnapshot {
  entries: VaultContextEntry[];
  totalFiles: number;
  windowDays: number;
  rendered: string;
}

export async function loadVaultContext(options: {
  windowDays?: number;
  maxFiles?: number;
  perFileChars?: number;
  totalChars?: number;
} = {}): Promise<VaultContextSnapshot> {
  const windowDays = options.windowDays ?? 7;
  const maxFiles = options.maxFiles ?? 20;
  const perFileChars = options.perFileChars ?? 1800;
  const totalChars = options.totalChars ?? 18_000;

  await ensureVault();
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;

  const collected: { path: string; full: string; mtime: number }[] = [];

  async function walk(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    await Promise.all(
      entries.map(async (entry) => {
        if (entry.name.startsWith(".")) return;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(fullPath);
          return;
        }
        if (!entry.name.toLowerCase().endsWith(".md")) return;
        const stat = await fs.stat(fullPath);
        if (stat.mtimeMs < cutoff) return;
        collected.push({ path: fullPath, full: fullPath, mtime: stat.mtimeMs });
      }),
    );
  }

  await walk(agenticosConfig.vaultPath);
  collected.sort((a, b) => b.mtime - a.mtime);
  const selected = collected.slice(0, maxFiles);

  const entries: VaultContextEntry[] = [];
  let used = 0;
  for (const file of selected) {
    if (used >= totalChars) break;
    let raw = "";
    try {
      raw = await fs.readFile(file.full, "utf8");
    } catch {
      continue;
    }
    const truncated = raw.length > perFileChars;
    const slice = truncated ? `${raw.slice(0, perFileChars)}\n\n…[truncated ${raw.length - perFileChars} chars]` : raw;
    const remaining = Math.max(0, totalChars - used);
    const suffix = "\n\n…[truncated]";
    const finalSlice =
      slice.length > remaining
        ? `${slice.slice(0, Math.max(0, remaining - suffix.length))}${suffix}`
        : slice;
    used += finalSlice.length;
    entries.push({
      path: path.relative(agenticosConfig.vaultPath, file.full).replaceAll("\\", "/"),
      updatedAt: new Date(file.mtime).toISOString(),
      content: finalSlice,
      truncated: truncated || finalSlice.length < slice.length,
    });
  }

  const rendered = entries.length
    ? entries
        .map(
          (entry) =>
            `### ${entry.path}\n_modified: ${entry.updatedAt}_${entry.truncated ? " (truncated)" : ""}\n\n${entry.content.trim()}`,
        )
        .join("\n\n---\n\n")
    : "_No vault notes modified in the selected window._";

  return {
    entries,
    totalFiles: collected.length,
    windowDays,
    rendered,
  };
}

export interface ObsidianFrontmatter {
  title: string;
  created: string;
  tags?: string[];
  category?: string;
  skill?: string;
  source?: string;
  runId?: string;
  cost?: number;
  model?: string;
  aliases?: string[];
}

function renderFrontmatter(fm: ObsidianFrontmatter): string {
  const lines = ["---"];
  Object.entries(fm).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      if (!value.length) return;
      lines.push(`${key}:`);
      value.forEach((v) => lines.push(`  - ${v}`));
    } else if (typeof value === "string") {
      lines.push(`${key}: ${JSON.stringify(value).slice(1, -1)}`);
    } else {
      lines.push(`${key}: ${value}`);
    }
  });
  lines.push("---", "");
  return lines.join("\n");
}

export interface WriteOptions {
  frontmatter?: Partial<ObsidianFrontmatter>;
  relatedLinks?: string[];
}

export async function writeVaultMarkdown(
  folder: string,
  title: string,
  body: string,
  options: WriteOptions = {},
): Promise<string> {
  await ensureVault();
  const date = new Date().toISOString().slice(0, 10);
  const safeFolder = folder.replace(/^\/?vault\/?/, "").replace(/^[/\\]+/, "");
  const dir = resolveVaultPath(safeFolder);
  await fs.mkdir(dir, { recursive: true });
  const fileName = `${date}-${slugify(title) || "note"}.md`;
  const fullPath = path.join(dir, fileName);

  const frontmatter: ObsidianFrontmatter = {
    title,
    created: nowIso(),
    tags: options.frontmatter?.tags ?? [],
    ...options.frontmatter,
  };

  const linksBlock = options.relatedLinks?.length
    ? `\n\n## Related\n${options.relatedLinks.map((l) => `- [[${l}]]`).join("\n")}\n`
    : "";

  const final = `${renderFrontmatter(frontmatter)}${body.trim()}${linksBlock}\n`;
  await fs.writeFile(fullPath, final, "utf8");
  return path.relative(agenticosConfig.vaultPath, fullPath).replaceAll("\\", "/");
}

export async function createDailyNote(content: string) {
  const date = new Date().toISOString().slice(0, 10);
  return writeVaultMarkdown("daily", date, `# ${date}\n\n${content}\n\n_Generated ${nowIso()}_\n`, {
    frontmatter: { tags: ["daily"], category: "daily" },
  });
}

export function extractWikiLinks(content: string): string[] {
  const matches = content.matchAll(/\[\[([^\]]+)\]\]/g);
  const links = new Set<string>();
  for (const m of matches) {
    const target = m[1].split("|")[0].trim();
    if (target) links.add(target);
  }
  return Array.from(links);
}
