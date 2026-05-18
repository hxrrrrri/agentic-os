import { describe, expect, it } from "vitest";
import { defaultTierForSkillCategory, routeForSkill } from "@/lib/billing/router";
import type { SelectedModelProfile } from "@/types";

describe("billing/router", () => {
  const activeProfile: SelectedModelProfile = {
    providerId: "openai",
    model: "gpt-5.5",
    reasoningEffort: "medium",
  };

  it("does not implicitly reroute categorized prompt templates away from the active profile", () => {
    expect(defaultTierForSkillCategory("memory")).toBe("default");
    expect(defaultTierForSkillCategory("productivity")).toBe("default");
    expect(defaultTierForSkillCategory("research")).toBe("default");
    expect(defaultTierForSkillCategory("content")).toBe("default");
    expect(defaultTierForSkillCategory("dev")).toBe("default");
  });

  it("honors the active profile for default routing", () => {
    expect(routeForSkill("default", activeProfile)).toEqual(activeProfile);
  });

  it("still allows explicit cheap routing for skills that opt in", () => {
    expect(routeForSkill("cheap", activeProfile)).toMatchObject({
      providerId: "ollama",
      model: "llama3.2:latest",
    });
  });
});
