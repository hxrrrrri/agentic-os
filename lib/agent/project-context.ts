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

export async function loadProjectModelContext() {
  const files = await loadContextFiles();
  let totalChars = 0;
  const included: string[] = [];

  for (const file of files) {
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

  return [
    "## AgenticOS Portable Project Context",
    "The following markdown files define project-level behavior that should apply across all LLM providers.",
    ...included,
  ].join("\n\n");
}
