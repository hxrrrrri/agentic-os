"use client";

import type { Skill } from "@/types";

const order = ["memory", "productivity", "research", "content", "business", "dev", "custom"];

export function SkillGrid({ skills, onSelect }: { skills: Skill[]; onSelect: (skill: Skill) => void }) {
  const groups = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    acc[skill.category] ??= [];
    acc[skill.category].push(skill);
    return acc;
  }, {});
  return (
    <div className="grid gap-6">
      {order.map((category) => (
        <section key={category}>
          <div className="mb-2 flex items-center gap-3">
            <div className="terminal-label text-[#e86f3a]">{category}</div>
            <div className="h-px flex-1 bg-[#242920]" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {(groups[category] ?? []).map((skill) => (
              <button
                key={skill.id}
                onClick={() => onSelect(skill)}
                disabled={!skill.enabled}
                className="h-8 rounded-[5px] border border-[#3a4038] bg-[#10120f] px-2 text-center text-[0.72rem] font-semibold text-[#f4f1e8] transition hover:border-[#e86f3a] hover:bg-[#15160f] hover:text-[#e86f3a] disabled:text-[#6f6a61] disabled:opacity-60"
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
