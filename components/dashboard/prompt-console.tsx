"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Play, RotateCcw } from "lucide-react";
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
      const data = (await response.json()) as { run?: { id: string }; error?: string };
      if (data.run?.id) router.push(`/runs/${data.run.id}`);
    });
  }

  return (
    <section className="space-y-3">
      <div className="terminal-panel bg-[#101311] p-3">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <div className="terminal-label">Universal Prompt Router</div>
            <div className="mt-1 text-xs text-[#6f6a61]">{selectedSkill ? `${selectedSkill.name} · ${selectedSkill.executionMode}` : "type any prompt or pick a skill below"}</div>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setPrompt("")} type="button">
              <RotateCcw size={14} /> Clear
            </Button>
            <Button onClick={run} disabled={!prompt.trim() || isPending} type="button" className="border-[#e86f3a] text-[#e86f3a]">
              <Play size={14} /> {isPending ? "Running" : "Run"}
            </Button>
          </div>
        </div>
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="type any prompt, or pick a skill below to load a template..."
          className="min-h-36 w-full resize-y border border-[#2a302c] bg-[#080a09] p-3 text-sm leading-6 text-[#f4f1e8] outline-none placeholder:text-[#6f6a61] focus:border-[#e86f3a]"
        />
      </div>
      <SkillGrid skills={skills} onSelect={selectSkill} />
    </section>
  );
}
