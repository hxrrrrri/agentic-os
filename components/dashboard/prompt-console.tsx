"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SkillGrid } from "@/components/dashboard/skill-grid";
import type { ModelEndpoint, ReasoningEffort, SelectedModelProfile, Skill, ThinkingLevel } from "@/types";

function getInitialModel(provider: ModelEndpoint) {
  return provider.models?.includes(provider.model) ? provider.model : provider.models?.[0] ?? provider.model;
}

export function PromptConsole({ skills, providers }: { skills: Skill[]; providers: ModelEndpoint[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const initialSkill = skills.find((skill) => skill.id === params.get("skill"));
  const [prompt, setPrompt] = useState(initialSkill?.template ?? "");
  const [selectedSkill, setSelectedSkill] = useState<Skill | undefined>(initialSkill);
  const [runError, setRunError] = useState<string | null>(null);
  const [autoRoute, setAutoRoute] = useState(true);
  const [isPending, startTransition] = useTransition();

  function selectSkill(skill: Skill) {
    setSelectedSkill(skill);
    setPrompt(skill.template);
    setRunError(null);
  }

  function run() {
    setRunError(null);
    startTransition(async () => {
      try {
        const defaultProvider = providers.find((provider) => provider.enabled) ?? providers[0];
        const storedProviderId = window.localStorage.getItem("agenticos.activeProvider");
        const activeProvider = providers.find((item) => item.id === storedProviderId) ?? defaultProvider;
        const storedModels = window.localStorage.getItem("agenticos.providerModels");
        const storedThinking = window.localStorage.getItem("agenticos.providerThinking");
        const storedEffort = window.localStorage.getItem("agenticos.providerEffort");

        const parseRecord = <T,>(raw: string | null): Record<string, T> => {
          if (!raw) return {};
          try {
            return JSON.parse(raw) as Record<string, T>;
          } catch {
            return {};
          }
        };

        const selectedModels = parseRecord<string>(storedModels);
        const thinkingMap = parseRecord<ThinkingLevel>(storedThinking);
        const effortMap = parseRecord<ReasoningEffort>(storedEffort);
        const model = activeProvider ? selectedModels[activeProvider.id] ?? getInitialModel(activeProvider) : undefined;

        const modelProfile: SelectedModelProfile | undefined =
          activeProvider && model
            ? {
                providerId: activeProvider.id,
                model,
                thinking: thinkingMap[activeProvider.id],
                reasoningEffort: effortMap[activeProvider.id],
              }
            : undefined;
        const response = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            skillId: selectedSkill?.id,
            dryRun: true,
            modelProfile,
            autoRoute: !selectedSkill && autoRoute,
          }),
        });
        const data = (await response.json().catch(() => ({}))) as { run?: { id: string }; error?: string };
        if (!response.ok) throw new Error(data.error ?? `Run request failed (${response.status})`);
        if (!data.run?.id) throw new Error("Run was created without an id");
        router.push(`/runs/${data.run.id}`);
      } catch (error) {
        setRunError(error instanceof Error ? error.message : "Run failed to start");
      }
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
              {isPending ? "Running..." : "Run"} <ArrowRight size={13} />
            </Button>
            <Button onClick={() => { setPrompt(""); setRunError(null); }} type="button">
              Clear
            </Button>
          </div>
          {runError ? (
            <div className="mt-2 border border-[#5a2424] bg-[#100808] px-2 py-1.5 text-[0.64rem] leading-5 text-[#e0a8a8]">
              {runError}
            </div>
          ) : null}
          <div className="mt-2 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.14em] text-[#6f6a61]">
            <span>
              {selectedSkill ? `${selectedSkill.name} / ${selectedSkill.executionMode}` : autoRoute ? "auto-router on" : "router standing by"}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5 normal-case tracking-normal text-[#8b857b]">
              <input
                type="checkbox"
                checked={autoRoute}
                onChange={(e) => setAutoRoute(e.target.checked)}
                disabled={Boolean(selectedSkill)}
                className="h-3 w-3 accent-[#e86f3a]"
              />
              <span>Auto-pick skill</span>
            </label>
          </div>
        </div>
      </div>

      <SkillGrid skills={skills} onSelect={selectSkill} />
    </section>
  );
}
