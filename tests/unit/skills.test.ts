import { describe, it, expect } from "vitest";
import { classifyPrompt, listSkills, getSkill, getSkillGroups } from "@/lib/skills/registry";

describe("skills/registry", () => {
  it("returns at least one skill", () => {
    expect(listSkills().length).toBeGreaterThan(0);
  });

  it("returns undefined for unknown skill id", () => {
    expect(getSkill("does-not-exist")).toBeUndefined();
    expect(getSkill(null)).toBeUndefined();
    expect(getSkill(undefined)).toBeUndefined();
  });

  it("groups skills by category", () => {
    const groups = getSkillGroups();
    expect(Object.keys(groups).length).toBeGreaterThan(0);
    for (const skills of Object.values(groups)) {
      expect(skills.length).toBeGreaterThan(0);
    }
  });

  describe("classifyPrompt", () => {
    it("classifies vault prompts as memory", () => {
      expect(classifyPrompt("update my vault note")).toBe("memory");
    });

    it("classifies inbox prompts as productivity", () => {
      expect(classifyPrompt("triage email inbox")).toBe("productivity");
    });

    it("classifies competitor prompts as research", () => {
      expect(classifyPrompt("scan competitor market")).toBe("research");
    });

    it("classifies youtube prompts as content", () => {
      expect(classifyPrompt("write youtube script")).toBe("content");
    });

    it("classifies stripe prompts as custom", () => {
      expect(classifyPrompt("fetch stripe revenue")).toBe("custom");
    });

    it("falls back to memory for unknown prompts", () => {
      expect(classifyPrompt("xyz123")).toBe("memory");
    });
  });
});
