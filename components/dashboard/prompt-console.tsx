"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillGrid } from "@/components/dashboard/skill-grid";
import type { Skill } from "@/types";

export function PromptConsole({ skills }: { skills: Skill[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const initialSkill = skills.find((skill) => skill.id === params.get("skill"));
  const [prompt, setPrompt] = useState(initialSkill?.template ?? "");
  const [selectedSkill, setSelectedSkill] = useState<Skill | undefined>(initialSkill);
  const [isPending, startTransition] = useTransition();

  function selectSkill(skill: Skill) {
    setSelectedSkill(skill);
    setPrompt(skill.template);
  }

  function run() {
    startTransition(async () => {
      const response = await fetch("/api/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, skillId: selectedSkill?.id, dryRun: true }),
      });
      const data = (await response.json()) as { run?: { id: string } };
      if (data.run?.id) router.push(`/runs/${data.run.id}`);
    });
  }

  return (
    <section className="space-y-8">
      <div className="space-y-5">
        <div className="terminal-panel bg-[#121411] p-3">
          <div className="terminal-label mb-7">Ready</div>
          <div className="px-1 pb-2">
            <div className="text-[27px] font-black leading-none tracking-[0.04em] text-[#f4f1e8] md:text-[31px]">
              RUN A <span className="text-[#e86f3a]">SKILL</span> TO BEGIN
            </div>
            <div className="mt-7 text-[0.68rem] text-[#8b857b]">click a skill - press run - or type any prompt</div>
          </div>
        </div>

        <div>
          <div className="terminal-label mb-2 text-[#e86f3a]">Prompt</div>
          <textarea
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="type any prompt, or pick a skill below to load a template..."
            className="min-h-24 w-full resize-y rounded-[4px] border border-[#30342c] bg-[#151713] p-3 text-[0.72rem] leading-5 text-[#f4f1e8] outline-none placeholder:text-[#8b857b] focus:border-[#e86f3a]"
          />
          <div className="mt-3 grid grid-cols-[1fr_180px] gap-3">
            <Button onClick={run} disabled={!prompt.trim() || isPending} type="button" className="border-[#30342c] bg-[#10120f]">
              {isPending ? "Running" : "Run"} <ArrowRight size={13} />
            </Button>
            <Button onClick={() => setPrompt("")} type="button">
              Clear
            </Button>
          </div>
          <div className="mt-2 text-[0.58rem] uppercase tracking-[0.14em] text-[#6f6a61]">
            {selectedSkill ? `${selectedSkill.name} / ${selectedSkill.executionMode}` : "router standing by"}
          </div>
        </div>
      </div>

      <SkillGrid skills={skills} onSelect={selectSkill} />
    </section>
  );
}
