import fs from "node:fs/promises";
import path from "node:path";
import { agenticosConfig } from "@/agenticos.config";
import type { BrandKit } from "@/types";

const DEFAULT_BRAND: BrandKit = {
  name: "AgenticOS",
  palette: {
    background: "#080a09",
    foreground: "#f4f1e8",
    accent: "#e86f3a",
    muted: "#a8a29a",
    surface: "#11140f",
  },
  fonts: {
    heading: "Inter, system-ui, sans-serif",
    body: "Inter, system-ui, sans-serif",
  },
  voice: "Direct, expert, terse. No filler. Lead with the punchline.",
};

let cache: { kit: BrandKit; loadedAt: number } | null = null;
const TTL_MS = 30_000;

interface BrandFile {
  name?: string;
  palette?: Partial<BrandKit["palette"]>;
  fonts?: Partial<BrandKit["fonts"]>;
  voice?: string;
}

function parseFrontmatter(raw: string): Record<string, unknown> {
  const match = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out: Record<string, unknown> = {};
  for (const line of match[1].split("\n")) {
    const eq = line.indexOf(":");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim().replace(/^"|"$/g, "");
    if (!k) continue;
    out[k] = v;
  }
  return out;
}

async function readBrandJson(file: string): Promise<BrandFile | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as BrandFile;
  } catch {
    return null;
  }
}

async function readBrandMarkdown(file: string): Promise<BrandFile | null> {
  try {
    const raw = await fs.readFile(file, "utf8");
    const fm = parseFrontmatter(raw) as BrandFile & { palette?: string; fonts?: string };
    const out: BrandFile = {};
    if (typeof fm.name === "string") out.name = fm.name;
    if (typeof fm.voice === "string") out.voice = fm.voice;
    const palette: Record<string, string> = {};
    const fonts: Record<string, string> = {};
    for (const [key, value] of Object.entries(fm)) {
      if (typeof value !== "string") continue;
      if (key.startsWith("palette.")) palette[key.slice("palette.".length)] = value;
      if (key.startsWith("fonts.")) fonts[key.slice("fonts.".length)] = value;
    }
    if (Object.keys(palette).length) out.palette = palette as Partial<BrandKit["palette"]>;
    if (Object.keys(fonts).length) out.fonts = fonts as Partial<BrandKit["fonts"]>;
    return out;
  } catch {
    return null;
  }
}

async function readLogoSvg(): Promise<string | undefined> {
  const candidate = path.join(agenticosConfig.vaultPath, "brand", "logo.svg");
  try {
    return await fs.readFile(candidate, "utf8");
  } catch {
    return undefined;
  }
}

const BRAND_README = `# Brand Kit

This folder configures the visual + voice defaults that AgenticOS uses when
rendering carousels, thumbnails, and AI images.

\`brand.json\` is the source of truth — it is auto-seeded on first use with
the defaults from \`DEFAULT_BRAND_KIT\`. Edit it freely and the next render
will pick up your changes (cached for 30s).

## Schema

\`\`\`jsonc
{
  "name": "string",         // brand name used in artifact captions
  "palette": {
    "background": "#hex",   // canvas background
    "foreground": "#hex",   // primary text color
    "accent":     "#hex",   // headline / highlight color
    "muted":      "#hex",   // secondary text / borders
    "surface":    "#hex"    // card / slide background
  },
  "fonts": {
    "heading": "CSS font stack",
    "body":    "CSS font stack"
  },
  "voice": "one-sentence tone description fed to the model"
}
\`\`\`

## Logo

Drop \`logo.svg\` into this folder and AgenticOS will overlay it on
thumbnails and carousel covers.

## Alternative format

If \`brand.json\` is missing, AgenticOS will fall back to \`brand.md\` with
the same fields flattened into YAML frontmatter (e.g. \`palette.accent: "#e86f3a"\`).
`;

async function ensureBrandSeed(brandDir: string): Promise<void> {
  const jsonPath = path.join(brandDir, "brand.json");
  const readmePath = path.join(brandDir, "README.md");
  try {
    await fs.access(jsonPath);
    return; // already seeded
  } catch {
    // not present — seed below
  }
  try {
    await fs.mkdir(brandDir, { recursive: true });
    await fs.writeFile(jsonPath, JSON.stringify(DEFAULT_BRAND, null, 2) + "\n", "utf8");
    try {
      await fs.access(readmePath);
    } catch {
      await fs.writeFile(readmePath, BRAND_README, "utf8");
    }
  } catch {
    // Seed best-effort. If the FS is read-only the defaults still apply.
  }
}

/** Load brand kit from `vault/brand/brand.json` or `vault/brand/brand.md`.
 *  Auto-seeds brand.json + README.md on first call so the user always has a
 *  single file to edit. Cached for 30s to keep tight render loops snappy. */
export async function loadBrandKit(): Promise<BrandKit> {
  if (cache && Date.now() - cache.loadedAt < TTL_MS) return cache.kit;
  const brandDir = path.join(agenticosConfig.vaultPath, "brand");
  await ensureBrandSeed(brandDir);
  const json = await readBrandJson(path.join(brandDir, "brand.json"));
  const md = json ? null : await readBrandMarkdown(path.join(brandDir, "brand.md"));
  const overrides = json ?? md ?? {};

  const kit: BrandKit = {
    name: overrides.name ?? DEFAULT_BRAND.name,
    palette: { ...DEFAULT_BRAND.palette, ...(overrides.palette ?? {}) },
    fonts: { ...DEFAULT_BRAND.fonts, ...(overrides.fonts ?? {}) },
    voice: overrides.voice ?? DEFAULT_BRAND.voice,
    logoSvg: await readLogoSvg(),
  };
  cache = { kit, loadedAt: Date.now() };
  return kit;
}

export function clearBrandCache() {
  cache = null;
}

export const DEFAULT_BRAND_KIT = DEFAULT_BRAND;
