// Doc viewer source resolution.
// Exposes:
//   - all .md files under .agenticos-project/ (canonical project rules, agents, skills, etc.)
//   - selected top-level project docs (README, CLAUDE, AUDIT_REPORT, ROADMAP_FEATURES, USER_CHECKLIST, STARTUP_WIRING)
//
// Reads are restricted to a small whitelist of roots to avoid path-traversal
// into the rest of the repo.
import fsp from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";

export interface DocFileEntry {
  id: string;
  title: string;
  group: string;
  bytes: number;
  updatedAt: string;
}

const ROOT_DOC_FILES = [
  "README.md",
  "CLAUDE.md",
  "AUDIT_REPORT.md",
  "ROADMAP_FEATURES.md",
  "USER_CHECKLIST.md",
  "STARTUP_WIRING.md",
];

function idFromPath(group: "project" | "root", relativePath: string) {
  return `${group}:${relativePath.replaceAll("\\", "/")}`;
}

function titleFromContent(raw: string, fallback: string): string {
  const h = raw.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return h ?? fallback;
}

async function walk(root: string, current: string, out: string[]): Promise<void> {
  let entries;
  try {
    entries = await fsp.readdir(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(current, entry.name);
    if (entry.isDirectory()) {
      await walk(root, full, out);
    } else if (entry.name.endsWith(".md")) {
      out.push(path.relative(root, full).replaceAll("\\", "/"));
    }
  }
}

async function safeStat(p: string) {
  try {
    return await fsp.stat(p);
  } catch {
    return null;
  }
}

export async function listDocs(): Promise<DocFileEntry[]> {
  const entries: DocFileEntry[] = [];

  // .agenticos-project/**.md
  const projectRoot = agenticosConfig.projectContextPath;
  const projectFiles: string[] = [];
  await walk(projectRoot, projectRoot, projectFiles);
  for (const rel of projectFiles.sort()) {
    const full = path.join(projectRoot, rel);
    const stat = await safeStat(full);
    if (!stat) continue;
    let title = rel;
    try {
      const raw = await fsp.readFile(full, "utf8");
      title = titleFromContent(raw, rel.replace(/\.md$/, ""));
    } catch {}
    entries.push({
      id: idFromPath("project", rel),
      title,
      group: rel.includes("/") ? rel.split("/")[0] : "project",
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  // top-level project docs
  for (const name of ROOT_DOC_FILES) {
    const full = path.join(process.cwd(), name);
    const stat = await safeStat(full);
    if (!stat) continue;
    let title = name;
    try {
      const raw = await fsp.readFile(full, "utf8");
      title = titleFromContent(raw, name.replace(/\.md$/, ""));
    } catch {}
    entries.push({
      id: idFromPath("root", name),
      title,
      group: "repo",
      bytes: stat.size,
      updatedAt: stat.mtime.toISOString(),
    });
  }

  return entries;
}

export async function readDoc(id: string): Promise<{ content: string; title: string; relativePath: string }> {
  const [group, ...rest] = id.split(":");
  const rel = rest.join(":");
  if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
    throw new Error("Invalid doc id");
  }
  if (group === "project") {
    const root = path.resolve(agenticosConfig.projectContextPath);
    const target = path.resolve(root, rel);
    const r = path.relative(root, target);
    if (r.startsWith("..") || path.isAbsolute(r)) throw new Error("Refusing to read outside project context");
    const content = await fsp.readFile(target, "utf8");
    return { content, title: titleFromContent(content, rel), relativePath: rel };
  }
  if (group === "root") {
    if (!ROOT_DOC_FILES.includes(rel)) throw new Error("Doc not in whitelist");
    const target = path.join(process.cwd(), rel);
    const content = await fsp.readFile(target, "utf8");
    return { content, title: titleFromContent(content, rel), relativePath: rel };
  }
  throw new Error("Unknown doc group");
}
