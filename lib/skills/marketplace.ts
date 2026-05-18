/**
 * Folder-based skill marketplace.
 *
 * Drop a JSON file at `data/skills/<id>.skill.json` and it becomes a first-class
 * skill, no code change. The manifest matches the `Skill` shape with a few
 * shorthand defaults applied if missing.
 */

import fsp from "node:fs/promises";
import path from "node:path";
import type { Skill, SkillCategory } from "@/types";

const MARKETPLACE_DIR = path.join(process.cwd(), "data", "skills");

const DEFAULT_OUTPUT: Record<SkillCategory, string> = {
  memory: "/vault/memory",
  productivity: "/vault/daily",
  research: "/vault/wiki",
  content: "/vault/content",
  custom: "/vault/runs",
  dev: "/vault/projects",
  business: "/vault/projects",
};

interface SkillManifest extends Partial<Skill> {
  id: string;
  name: string;
  category: SkillCategory;
}

function applyDefaults(m: SkillManifest): Skill {
  return {
    id: m.id,
    name: m.name,
    category: m.category,
    description: m.description ?? `${m.name} — marketplace skill`,
    template: m.template ?? `Run the ${m.name} workflow against the current prompt.`,
    requiredIntegrations: m.requiredIntegrations ?? [],
    riskLevel: m.riskLevel ?? "low",
    outputLocation: m.outputLocation ?? DEFAULT_OUTPUT[m.category],
    enabled: m.enabled ?? true,
    executionMode: m.executionMode ?? "dry-run",
  };
}

let cache: Skill[] | null = null;
let cacheAt = 0;
const TTL_MS = 5_000;

export async function loadMarketplaceSkills(): Promise<Skill[]> {
  if (cache && Date.now() - cacheAt < TTL_MS) return cache;
  let entries;
  try {
    entries = await fsp.readdir(MARKETPLACE_DIR, { withFileTypes: true });
  } catch {
    cache = [];
    cacheAt = Date.now();
    return cache;
  }
  const out: Skill[] = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (!entry.name.endsWith(".skill.json")) continue;
    try {
      const raw = await fsp.readFile(path.join(MARKETPLACE_DIR, entry.name), "utf8");
      const manifest = JSON.parse(raw) as SkillManifest;
      if (!manifest.id || !manifest.name || !manifest.category) continue;
      out.push(applyDefaults(manifest));
    } catch {
      // skip malformed manifests
    }
  }
  cache = out;
  cacheAt = Date.now();
  return cache;
}

export function invalidateMarketplaceCache() {
  cache = null;
}
