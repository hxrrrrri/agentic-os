import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";

export interface ProjectContextFile {
  path: string;
  title: string;
  chars: number;
  category: string;
}

interface LoadedContextFile extends ProjectContextFile {
  content: string;
}

const MAX_FILE_CHARS = 3_500;
const MAX_TOTAL_CHARS = 18_000;

const categoryPriority = [
  "project.md",
  "rules",
  "agents",
  "skills",
  "commands",
  "output-styles",
  "providers",
  "hooks",
  "README.md",
];

function normalizePath(filePath: string) {
  return filePath.replaceAll(path.sep, "/");
}

function categoryFor(relativePath: string) {
  const [first] = relativePath.split("/");
  return first.endsWith(".md") ? "root" : first;
}

function titleFor(relativePath: string, content: string) {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  return heading ?? relativePath.replace(/\.md$/, "").replaceAll("/", " / ");
}

function priorityFor(relativePath: string) {
  const normalized = normalizePath(relativePath);
  const exactIndex = categoryPriority.indexOf(normalized);

  if (exactIndex >= 0) {
    return exactIndex;
  }

  const categoryIndex = categoryPriority.findIndex((category) => normalized.startsWith(`${category}/`));
  return categoryIndex >= 0 ? categoryIndex : categoryPriority.length;
}

async function listMarkdownFiles(root: string, current = root): Promise<string[]> {
  let entries;

  try {
    entries = await readdir(current, { withFileTypes: true });
  } catch {
    return [];
  }

  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(current, entry.name);

      if (entry.isDirectory()) {
        return listMarkdownFiles(root, fullPath);
      }

      if (entry.isFile() && entry.name.endsWith(".md")) {
        return [normalizePath(path.relative(root, fullPath))];
      }

      return [];
    }),
  );

  return files.flat();
}

async function loadContextFiles(): Promise<LoadedContextFile[]> {
  const root = agenticosConfig.projectContextPath;
  const files = await listMarkdownFiles(root);
  const sortedFiles = files.sort((a, b) => {
    const priorityDelta = priorityFor(a) - priorityFor(b);
    return priorityDelta || a.localeCompare(b);
  });

  const loaded: LoadedContextFile[] = [];

  for (const relativePath of sortedFiles) {
    const fullPath = path.join(root, relativePath);
    const fileStat = await stat(fullPath);

    if (fileStat.size <= 0) {
      continue;
    }

    const raw = await readFile(fullPath, "utf8");
    const content = raw.trim().slice(0, MAX_FILE_CHARS);

    loaded.push({
      path: relativePath,
      title: titleFor(relativePath, content),
      chars: raw.length,
      category: categoryFor(relativePath),
      content,
    });
  }

  return loaded;
}

export async function getProjectContextManifest(): Promise<ProjectContextFile[]> {
  const files = await loadContextFiles();
  return files.map((file) => ({
    path: file.path,
    title: file.title,
    chars: file.chars,
    category: file.category,
  }));
}

// Per-category file globs. Files matching the request's category get full
// priority; everything else still loads but only if there's budget left.
const CATEGORY_HINT_PATTERNS: Record<string, RegExp[]> = {
  memory: [/vault/i, /memory/i, /daily/i],
  productivity: [/inbox/i, /gmail/i, /calendar/i, /drive/i, /agenda/i],
  research: [/research/i, /firecrawl/i, /crawl/i, /source/i, /market/i],
  content: [/youtube/i, /content/i, /script/i, /hook/i, /thumbnail/i, /short/i, /caption/i],
  custom: [/cli/i, /shell/i, /webhook/i, /mcp/i, /api/i],
  dev: [/repo/i, /github/i, /commit/i, /pr-?review/i, /diff/i, /test/i],
  business: [/stripe/i, /shopify/i, /crm/i, /salesforce/i, /hubspot/i, /pipedrive/i, /finance/i, /billing/i],
};

function priorityForCategory(relativePath: string, category?: string): number {
  if (!category) return 0;
  const patterns = CATEGORY_HINT_PATTERNS[category] ?? [];
  return patterns.some((p) => p.test(relativePath)) ? -10 : 0;
}

export async function loadProjectModelContext(options: { category?: string; prompt?: string } = {}) {
  const files = await loadContextFiles();

  // Re-sort: project.md and root rules always go first; then files matching
  // the prompt's category bubble up; everything else stays in default order.
  const promptCategory = options.category;
  const sorted = [...files].sort((a, b) => {
    const aPriority = priorityForCategory(a.path, promptCategory);
    const bPriority = priorityForCategory(b.path, promptCategory);
    if (aPriority !== bPriority) return aPriority - bPriority;
    return 0; // preserve existing priority order (categoryPriority list above)
  });

  let totalChars = 0;
  const included: string[] = [];

  for (const file of sorted) {
    const section = [`### ${file.path}`, file.content].join("\n\n");

    if (totalChars + section.length > MAX_TOTAL_CHARS) {
      continue;
    }

    included.push(section);
    totalChars += section.length;
  }

  if (included.length === 0) {
    return "";
  }

  const header = promptCategory
    ? `## AgenticOS Portable Project Context (routed for category: ${promptCategory})`
    : "## AgenticOS Portable Project Context";

  return [
    header,
    "The following markdown files define project-level behavior that should apply across all LLM providers.",
    ...included,
  ].join("\n\n");
}
