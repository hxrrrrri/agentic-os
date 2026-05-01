"use client";

import type { Skill } from "@/types";

const order = ["memory", "productivity", "research", "content", "custom"];

export function SkillGrid({ skills, onSelect }: { skills: Skill[]; onSelect: (skill: Skill) => void }) {
  const groups = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    acc[skill.category] ??= [];
    acc[skill.category].push(skill);
    return acc;
  }, {});
  return (
    <div className="grid gap-3">
      {order.map((category) => (
        <section key={category} className="terminal-panel bg-[#101311] p-3">
          <div className="terminal-label mb-3">{category}</div>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-5">
            {(groups[category] ?? []).map((skill) => (
              <button
                key={skill.id}
                onClick={() => onSelect(skill)}
                disabled={!skill.enabled}
                className="min-h-10 border border-[#2a302c] bg-[#080a09] px-2 py-2 text-left text-[0.7rem] uppercase tracking-[0.07em] text-[#a8a29a] transition hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-40"
                title={skill.description}
              >
                {skill.name}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
