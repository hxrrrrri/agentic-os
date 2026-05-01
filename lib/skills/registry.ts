import { seedSkills } from "@/data/seed-skills";
import type { Skill, SkillCategory } from "@/types";

const skillMap = new Map(seedSkills.map((skill) => [skill.id, skill]));

export function listSkills(category?: SkillCategory): Skill[] {
  const skills = Array.from(skillMap.values());
  return category ? skills.filter((skill) => skill.category === category) : skills;
}

export function getSkill(id?: string | null): Skill | undefined {
  if (!id) return undefined;
  return skillMap.get(id);
}

export function getSkillGroups() {
  return listSkills().reduce<Record<string, Skill[]>>((groups, skill) => {
    groups[skill.category] ??= [];
    groups[skill.category].push(skill);
    return groups;
  }, {});
}

export function classifyPrompt(prompt: string): SkillCategory {
  const lower = prompt.toLowerCase();
  const rules: Array<[SkillCategory, string[]]> = [
    ["memory", ["vault", "memory", "note", "obsidian", "daily"]],
    ["productivity", ["email", "inbox", "calendar", "meeting", "agenda", "drive"]],
    ["research", ["research", "source", "market", "competitor", "scrape", "firecrawl"]],
    ["content", ["youtube", "script", "post", "blog", "newsletter", "content", "hook"]],
    ["custom", ["cli", "api", "mcp", "webhook", "stripe", "shopify", "github", "crm"]],
  ];
  return rules.find(([, terms]) => terms.some((term) => lower.includes(term)))?.[0] ?? "memory";
}
