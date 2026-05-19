/**
 * Auto-skill router. Picks one best-fit skill (or none) for a free-text prompt.
 *
 * Two stages:
 *   1. Heuristic — keyword/token overlap, zero LLM cost. Wins when confident.
 *   2. LLM tiebreaker — only when top-2 heuristic candidates are close. Uses
 *      a cheap classifier model (Haiku / mini / flash / local Ollama).
 *
 * Decisions are cached in `prompt_cache` keyed by `route:<sha256(prompt)>`.
 */

import { createHash } from "node:crypto";
import type { SelectedModelProfile, Skill, SkillCategory } from "@/types";
import { listSkills } from "@/lib/skills/registry";
import { generateWithModel } from "@/lib/agent/llm";
import { getProvider, listModelProviders } from "@/lib/agent/providers";
import { getCached, putCached } from "@/lib/billing/cache";
import { routeForSkill } from "@/lib/billing/router";

export interface RouteResult {
  skill?: Skill;
  confidence: number;
  reason: string;
  candidates: Array<{ id: string; score: number }>;
  tokensUsed: number;
}

export interface RouteOptions {
  modelProfile?: SelectedModelProfile;
  forceLLM?: boolean;
  allowSkip?: boolean;
}

const PHRASE_BONUSES: Array<[RegExp, string[]]> = [
  [/\bcarousel\b/i, ["carousel"]],
  [/\bthumbnail\b/i, ["thumbnail"]],
  [/\binbox\b|\bunread\b/i, ["inbox"]],
  [/\bsummari[sz]e\s+emails?\b|\bemail\s+summary\b/i, ["gmail", "summary"]],
  [/\bcalendar\b|\bagenda\b|\bmeetings?\b/i, ["calendar"]],
  [/\bdrive\b|\bdocs?\b/i, ["drive"]],
  [/\bscrape\b|\bfirecrawl\b|\bcrawl\b/i, ["scrape", "firecrawl"]],
  [/\byoutube\b|\bvideos?\b|\bthumbnails?\b/i, ["youtube"]],
  [/\bdaily\s+note\b|\bdream\b/i, ["daily", "dream"]],
  [/\bgithub\b|\bpr\b|\bpull\s+request\b/i, ["github"]],
  [/\bstripe\b|\brefund\b|\bcharge\b/i, ["stripe"]],
];

const CATEGORY_HINTS: Record<SkillCategory, string[]> = {
  memory: ["vault", "memory", "note", "obsidian", "daily", "dream", "kb"],
  productivity: ["email", "inbox", "calendar", "meeting", "agenda", "drive", "gmail"],
  research: ["research", "source", "market", "competitor", "scrape", "firecrawl", "trend"],
  content: ["youtube", "script", "post", "blog", "newsletter", "content", "hook", "carousel", "thumbnail", "image"],
  custom: ["cli", "api", "mcp", "webhook", "stripe", "shopify", "github", "crm"],
  dev: ["pr", "review", "changelog", "release", "code", "test"],
  business: ["mrr", "churn", "revenue", "expense", "goal", "report"],
};

const STOPWORDS = new Set([
  "a","an","and","are","as","at","be","by","for","from","has","have","i","in","is","it","of","on","or","that","the","this","to","was","were","will","with","my","me","you","your","please","can","could","would","should","help",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w && w.length > 2 && !STOPWORDS.has(w));
}

function coverage(promptTokens: Set<string>, skillTokens: Set<string>): number {
  if (!promptTokens.size || !skillTokens.size) return 0;
  let hits = 0;
  for (const t of promptTokens) if (skillTokens.has(t)) hits += 1;
  return hits / promptTokens.size;
}

function scoreSkill(promptTokens: Set<string>, promptLower: string, skill: Skill): number {
  const corpus = [
    skill.name,
    skill.description,
    skill.id.replace(/-/g, " "),
    (skill.requiredIntegrations ?? []).join(" "),
    (skill.tools ?? []).join(" "),
    skill.category,
  ].join(" ");
  const skillTokens = new Set(tokenize(corpus));
  let score = coverage(promptTokens, skillTokens);

  // Phrase bonuses — small additive bumps for high-signal hits.
  for (const [pattern, tokens] of PHRASE_BONUSES) {
    if (!pattern.test(promptLower)) continue;
    for (const t of tokens) {
      if (skillTokens.has(t) || skill.id.includes(t)) score += 0.12;
    }
  }

  // Category alignment bonus.
  const catHints = CATEGORY_HINTS[skill.category] ?? [];
  for (const hint of catHints) {
    if (promptLower.includes(hint)) {
      score += 0.04;
      break;
    }
  }

  // Tool-name direct hits get a strong bonus — e.g. "render carousel" → carousel-design.
  for (const tool of skill.tools ?? []) {
    const bare = tool.replace(/_/g, " ");
    if (promptLower.includes(bare) || promptLower.includes(tool)) score += 0.15;
  }

  if (skill.useTools && /\b(carousel|thumbnail|image|creative|artifact|gmail|email|calendar|drive)\b/i.test(promptLower)) {
    score += 0.08;
  }

  return Math.min(score, 1);
}

function hashPrompt(prompt: string): string {
  return "route:" + createHash("sha256").update(prompt.trim().toLowerCase()).digest("hex");
}

const CHEAP_PREFS: Array<{ id: string; model: string }> = [
  { id: "ollama", model: "llama3.2:latest" },
  { id: "anthropic", model: "claude-haiku-4-5-20251001" },
  { id: "openai", model: "gpt-5.5-mini" },
  { id: "gemini", model: "gemini-2.5-flash-lite" },
];

function pickClassifierProfile(active?: SelectedModelProfile): SelectedModelProfile | undefined {
  const providers = listModelProviders();
  for (const pref of CHEAP_PREFS) {
    const p = providers.find((x) => x.id === pref.id);
    if (!p) continue;
    if (p.requiresApiKey) {
      const envName = `${pref.id.replace(/-/g, "").toUpperCase()}_API_KEY`;
      if (!process.env[envName]) continue;
    }
    return { providerId: p.id, model: pref.model };
  }
  if (active) return routeForSkill("cheap", active);
  return undefined;
}

function parseSkillIdFromReply(reply: string, candidates: Array<{ id: string }>): string | undefined {
  const cleaned = reply.trim().split(/\s+/)[0]?.replace(/[`"'.,;:]/g, "").toLowerCase();
  if (!cleaned) return undefined;
  if (cleaned === "none") return undefined;
  const hit = candidates.find((c) => c.id.toLowerCase() === cleaned);
  return hit?.id;
}

export async function routeSkill(prompt: string, opts: RouteOptions = {}): Promise<RouteResult> {
  const allowSkip = opts.allowSkip !== false;
  const trimmed = prompt.trim();
  if (!trimmed) return { skill: undefined, confidence: 0, reason: "empty prompt", candidates: [], tokensUsed: 0 };

  // Cache short-circuit (1h TTL via createdAt).
  const key = hashPrompt(trimmed);
  const cached = await getCached(key).catch(() => null);
  if (cached) {
    const ageMs = Date.now() - new Date(cached.createdAt).getTime();
    if (Number.isFinite(ageMs) && ageMs < 60 * 60 * 1000) {
      try {
        const parsed = JSON.parse(cached.response) as { skillId?: string; confidence: number; reason: string; candidates: Array<{ id: string; score: number }> };
        const skills = listSkills();
        const skill = parsed.skillId ? skills.find((s) => s.id === parsed.skillId) : undefined;
        return { skill, confidence: parsed.confidence, reason: parsed.reason, candidates: parsed.candidates, tokensUsed: 0 };
      } catch {
        // fall through and recompute
      }
    }
  }

  const skills = listSkills().filter((s) => s.enabled !== false);
  const lower = trimmed.toLowerCase();
  const promptTokens = new Set(tokenize(trimmed));

  const scored = skills
    .map((s) => ({ skill: s, score: scoreSkill(promptTokens, lower, s) }))
    .sort((a, b) => b.score - a.score);
  const candidates = scored.slice(0, 5).map((c) => ({ id: c.skill.id, score: Number(c.score.toFixed(3)) }));

  const top = scored[0];
  const second = scored[1];

  // Skip — no skill scored meaningfully.
  if (!opts.forceLLM && allowSkip && (!top || top.score < 0.2)) {
    const result: RouteResult = {
      skill: undefined,
      confidence: top ? 1 - top.score : 1,
      reason: "no skill matched — generic prompt",
      candidates,
      tokensUsed: 0,
    };
    await persistRouteDecision(key, result).catch(() => {});
    return result;
  }

  // Confident heuristic hit.
  const gap = top && second ? top.score - second.score : top?.score ?? 0;
  if (!opts.forceLLM && top && top.score >= 0.55 && gap >= 0.15) {
    const result: RouteResult = {
      skill: top.skill,
      confidence: top.score,
      reason: `heuristic match (score ${top.score.toFixed(2)}, gap ${gap.toFixed(2)})`,
      candidates,
      tokensUsed: 0,
    };
    await persistRouteDecision(key, result).catch(() => {});
    return result;
  }

  // LLM tiebreaker.
  const top5 = scored.slice(0, 5).map((c) => c.skill);
  const profile = pickClassifierProfile(opts.modelProfile);
  if (!profile) {
    const fallback = top?.skill;
    const result: RouteResult = {
      skill: fallback,
      confidence: top?.score ?? 0,
      reason: "no classifier model available; used top heuristic",
      candidates,
      tokensUsed: 0,
    };
    await persistRouteDecision(key, result).catch(() => {});
    return result;
  }

  const provider = getProvider(profile.providerId);
  if (!provider) {
    const result: RouteResult = {
      skill: top?.skill,
      confidence: top?.score ?? 0,
      reason: "classifier provider missing; used top heuristic",
      candidates,
      tokensUsed: 0,
    };
    await persistRouteDecision(key, result).catch(() => {});
    return result;
  }

  const listText = top5
    .map((s, i) => `${i + 1}. ${s.id} — ${s.name}: ${s.description.slice(0, 90)}`)
    .join("\n");

  const systemExtra = "\nYou are a strict classifier. Reply with a single token: the skill id, or NONE.";
  const classifierPrompt = `User task:\n${trimmed}\n\nCandidates:\n${listText}\n\nReply with one skill id from the list, or NONE.`;

  let tokensUsed = 0;
  let pickedId: string | undefined;
  try {
    const generated = await generateWithModel({
      provider,
      model: profile.model,
      prompt: classifierPrompt,
      memoryCount: 0,
      systemExtra,
    });
    tokensUsed = generated.usage.inputTokens + generated.usage.outputTokens;
    pickedId = parseSkillIdFromReply(generated.content, top5.map((s) => ({ id: s.id })));
  } catch {
    pickedId = undefined;
  }

  const picked = pickedId ? top5.find((s) => s.id === pickedId) : top?.skill;
  const result: RouteResult = {
    skill: picked,
    confidence: picked ? Math.max(top?.score ?? 0, 0.5) : (top?.score ?? 0),
    reason: pickedId
      ? `LLM tiebreaker chose ${pickedId} from top 5`
      : "LLM tiebreaker fell back to heuristic top",
    candidates,
    tokensUsed,
  };
  await persistRouteDecision(key, result).catch(() => {});
  return result;
}

async function persistRouteDecision(key: string, result: RouteResult): Promise<void> {
  const payload = JSON.stringify({
    skillId: result.skill?.id,
    confidence: result.confidence,
    reason: result.reason,
    candidates: result.candidates,
  });
  await putCached(key, {
    provider: "router",
    model: "heuristic+llm",
    response: payload,
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
  });
}
