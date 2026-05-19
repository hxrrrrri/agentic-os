"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ReasoningEffort, SelectedModelProfile, ThinkingLevel } from "@/types";

interface CommandButton {
  label: string;
  hasMore?: boolean;
  skillId: string;
  prompt: string;
}

const row1: CommandButton[] = [
  { label: "Plan Today", skillId: "plan-today", prompt: "Generate today's plan from today's daily note, active calendar events, and outstanding tasks. Output a prioritized timeline." },
  { label: "Plan Tomorrow", skillId: "plan-tomorrow", prompt: "Scaffold tomorrow's daily note. Pull carryover tasks, scheduled events, and a top-3 focus list." },
  { label: "Morning Brief", skillId: "morning-brief", prompt: "Compile the morning brief from inbox, calendar, and overnight news. Highlight headlines, scheduled commitments, and the day's top 3 priorities." },
  { label: "Inbox Brief", skillId: "inbox-brief", prompt: "Triage inbox: summarize unread email + DMs, group by urgency, surface anything requiring a same-day reply." },
  { label: "Deep Research", hasMore: true, skillId: "deep-research", prompt: "Run deep research on the topic specified. Use multi-source synthesis with citations. Save to vault/wiki." },
];

const row2: CommandButton[] = [
  { label: "Content Cascade", hasMore: true, skillId: "content-cascade", prompt: "Take the source note and fan it out: YT script, short-form beats, X thread, blog post, IG caption, newsletter blurb. Cross-reference back to source." },
  { label: "YT Pipeline", hasMore: true, skillId: "yt-pipeline", prompt: "Run the YouTube pipeline: script polish → thumbnail brief → title variants → description + tags → upload metadata draft." },
  { label: "Weekly Review", skillId: "weekly-review", prompt: "Generate the weekly review: aggregate metrics, classify uploads (hit/steady/climbing/miss), surface patterns, propose next-week bets." },
  { label: "Vault Cleanup", skillId: "vault-cleanup", prompt: "Audit the vault. Surface orphans, dead links, duplicates. Propose cleanup actions only — do not modify files." },
  { label: "Pull Metrics", skillId: "pull-metrics", prompt: "Pull latest metrics from connected platforms (YouTube, Instagram, TikTok). Update dashboard cache and surface deltas." },
];

const THINKING_PROVIDER_IDS = new Set(["anthropic", "gemini-cli", "gemini", "ollama"]);
const EFFORT_PROVIDER_IDS = new Set(["claude-code", "codex", "copilot-cli", "openai", "grok", "nvidia", "openrouter"]);
const DEFAULT_MODEL_BY_PROVIDER: Record<string, string> = {
  "claude-code": "claude-sonnet-4-6",
  codex: "gpt-5.2",
  "copilot-cli": "claude-sonnet-4.6",
  "gemini-cli": "gemini-2.5-pro",
  ollama: "llama3.2:latest",
};

export function CommandBar() {
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function run(btn: CommandButton) {
    if (isPending) return;
    setPendingId(btn.skillId);
    startTransition(async () => {
      const providerId = window.localStorage.getItem("agenticos.activeProvider");
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
      const model = providerId ? selectedModels[providerId] ?? DEFAULT_MODEL_BY_PROVIDER[providerId] : undefined;
      const modelProfile: SelectedModelProfile | undefined =
        providerId && model
          ? {
              providerId,
              model,
              thinking: THINKING_PROVIDER_IDS.has(providerId) ? thinkingMap[providerId] ?? "off" : undefined,
              reasoningEffort: EFFORT_PROVIDER_IDS.has(providerId) ? effortMap[providerId] ?? "medium" : undefined,
            }
          : undefined;

      try {
        const response = await fetch("/api/runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: btn.prompt, skillId: btn.skillId, dryRun: true, modelProfile }),
        });
        const data = (await response.json()) as { run?: { id: string }; error?: string };
        if (data.run?.id) router.push(`/runs/${data.run.id}`);
      } finally {
        setPendingId(null);
      }
    });
  }

  return (
    <div className="space-y-[8px]">
      <Row buttons={row1} run={run} pendingId={pendingId} />
      <Row buttons={row2} run={run} pendingId={pendingId} />
    </div>
  );
}

function Row({
  buttons,
  run,
  pendingId,
}: {
  buttons: CommandButton[];
  run: (btn: CommandButton) => void;
  pendingId: string | null;
}) {
  return (
    <div className="grid grid-cols-1 gap-[8px] sm:grid-cols-2 md:grid-cols-5">
      {buttons.map((btn) => {
        const pending = pendingId === btn.skillId;
        return (
          <button
            key={btn.label}
            type="button"
            onClick={() => run(btn)}
            disabled={pendingId !== null}
            className={`group flex h-10 items-center justify-center gap-[8px] rounded-[1px] border px-4 text-[0.82rem] font-bold uppercase tracking-[0.1em] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition disabled:cursor-wait disabled:opacity-60 ${
              pending
                ? "border-[#e97848] bg-[#241813] text-[#e97848]"
                : "border-[#555] bg-[#303030] text-[#f4f1e8] hover:border-[#e97848]/70 hover:bg-[#383838] hover:text-[#f4f1e8]"
            }`}
          >
            <span className="truncate">{pending ? "…running" : btn.label}</span>
            {btn.hasMore && !pending ? (
              <span className="text-[#6f6a61] transition group-hover:text-[#e86f3a]">…</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
