/**
 * Per-skill model router. Skills can declare a cost tier (`cheap` / `default` /
 * `premium`); otherwise runs use the active provider/model selected by the user.
 *
 * Routing rules per tier (first match wins):
 *   cheap   → ollama → openai gpt-5.5-mini → anthropic haiku → fallback default
 *   default → user-selected active profile
 *   premium → claude-opus / gpt-5.5 / gemini-2.5-pro (whichever is enabled)
 */

import type { SelectedModelProfile } from "@/types";
import { getProvider, listModelProviders } from "@/lib/agent/providers";

export type CostTier = "cheap" | "default" | "premium";

const CHEAP_PREFERENCES: Array<{ id: string; model?: string }> = [
  { id: "ollama" },
  { id: "openai", model: "gpt-5.5-mini" },
  { id: "anthropic", model: "claude-haiku-4-5-20251001" },
  { id: "gemini", model: "gemini-2.5-flash-lite" },
];

const PREMIUM_PREFERENCES: Array<{ id: string; model?: string }> = [
  { id: "anthropic", model: "claude-opus-4-7" },
  { id: "openai", model: "gpt-5.5" },
  { id: "gemini", model: "gemini-2.5-pro" },
  { id: "claude-code", model: "claude-opus-4-7" },
];

function firstAvailable(prefs: Array<{ id: string; model?: string }>, fallback: SelectedModelProfile): SelectedModelProfile {
  const providers = listModelProviders();
  for (const pref of prefs) {
    const p = providers.find((x) => x.id === pref.id);
    if (!p) continue;
    // Cloud providers need a key; CLI/local always assumed installed at runtime.
    if (p.requiresApiKey) {
      const envName = `${pref.id.replace(/-/g, "").toUpperCase()}_API_KEY`;
      if (!process.env[envName] && !process.env[envName.replace("CLI", "")]) continue;
    }
    return { providerId: p.id, model: pref.model ?? p.model };
  }
  return fallback;
}

export function routeForSkill(
  tier: CostTier,
  userActive: SelectedModelProfile,
): SelectedModelProfile {
  if (tier === "default") return userActive;
  if (tier === "cheap") return firstAvailable(CHEAP_PREFERENCES, userActive);
  if (tier === "premium") {
    const promoted = firstAvailable(PREMIUM_PREFERENCES, userActive);
    return { ...userActive, providerId: promoted.providerId, model: promoted.model };
  }
  return userActive;
}

/** No implicit rerouting: prompts and templates honor the active profile unless a skill opts in. */
export function defaultTierForSkillCategory(category?: string): CostTier {
  void category;
  return "default";
}

export function providerExists(id: string): boolean {
  return Boolean(getProvider(id));
}
