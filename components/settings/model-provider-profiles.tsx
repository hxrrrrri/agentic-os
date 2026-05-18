"use client";

import { Brain, Check, KeyRound, Loader2, RefreshCw, Sparkles, WifiOff, Zap } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModelEndpoint, ReasoningEffort, ThinkingLevel } from "@/types";

interface ProviderModelState {
  models: string[];
  loading: boolean;
  error?: string;
}

type ProviderTestStatus = "idle" | "checking" | "ok" | "error";

interface ProviderTestState {
  status: ProviderTestStatus;
  message?: string;
}

const providerLabel: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  "copilot-cli": "GitHub Copilot CLI",
  ollama: "Ollama",
  nvidia: "NVIDIA",
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  grok: "Grok",
  custom: "Custom",
};

const THINKING_OPTIONS: { value: ThinkingLevel; label: string; budget: string }[] = [
  { value: "off", label: "Off", budget: "0" },
  { value: "think", label: "Think", budget: "4K" },
  { value: "think-hard", label: "Think hard", budget: "10K" },
  { value: "think-harder", label: "Think harder", budget: "32K" },
  { value: "ultrathink", label: "Ultrathink", budget: "32K" },
];

const EFFORT_OPTIONS: { value: ReasoningEffort; label: string }[] = [
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "XHigh" },
];

const THINKING_PROVIDERS = new Set(["claude-code", "anthropic", "gemini-cli", "gemini", "ollama"]);
const EFFORT_PROVIDERS = new Set(["codex", "copilot-cli", "openai", "grok", "nvidia", "openrouter"]);

function supportsThinking(provider: ModelEndpoint): boolean {
  return THINKING_PROVIDERS.has(provider.id) || THINKING_PROVIDERS.has(provider.provider);
}

function supportsEffort(provider: ModelEndpoint): boolean {
  return EFFORT_PROVIDERS.has(provider.id) || EFFORT_PROVIDERS.has(provider.provider);
}

function thinkingOptionsFor(provider: ModelEndpoint) {
  const id = provider.id || provider.provider;
  // Only Claude CLI accepts the keyword cascade (think / think hard / think harder / ultrathink).
  // Anthropic API / Gemini / Ollama get a simpler off/on/deep mapping.
  if (id === "claude-code") return THINKING_OPTIONS;
  if (id === "anthropic") return THINKING_OPTIONS.filter((o) => o.value !== "ultrathink");
  return THINKING_OPTIONS.filter((o) => o.value === "off" || o.value === "think" || o.value === "think-hard");
}

function effortOptionsFor(provider: ModelEndpoint) {
  const id = provider.id || provider.provider;
  // Codex CLI: `low | medium | high | xhigh` (from `codex exec --help`).
  // Copilot CLI: `low | medium | high | xhigh` (from `copilot --help` flag set).
  if (id === "copilot-cli" || id === "codex") {
    return EFFORT_OPTIONS.filter((option) => option.value !== "minimal");
  }
  // OpenAI / Grok / NVIDIA expose `minimal | low | medium | high` on the
  // reasoning models — xhigh is not part of their official enum.
  if (id === "openai" || id === "grok" || id === "nvidia") {
    return EFFORT_OPTIONS.filter((option) => option.value !== "xhigh");
  }
  return EFFORT_OPTIONS.filter((option) => option.value !== "xhigh");
}

function getInitialModel(provider: ModelEndpoint, models: string[]) {
  if (models.includes(provider.model)) {
    return provider.model;
  }
  return models[0] ?? provider.model;
}

function uniqueModels(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

function parseRecord<T>(raw: string | null): Record<string, T> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, T>;
  } catch {
    return {};
  }
}

export function ModelProviderProfiles({ providers }: { providers: ModelEndpoint[] }) {
  const defaultModels = useMemo(
    () =>
      Object.fromEntries(
        providers.map((provider) => [
          provider.id,
          getInitialModel(provider, uniqueModels(provider.models ?? [provider.model])),
        ]),
      ),
    [providers],
  );
  // Initial state must match SSR (no localStorage). The mount effect below hydrates from storage.
  const [activeProvider, setActiveProviderRaw] = useState<string>("");
  const [selectedModels, setSelectedModelsRaw] = useState<Record<string, string>>(() => defaultModels);
  const [thinking, setThinkingRaw] = useState<Record<string, ThinkingLevel>>({});
  const [effort, setEffortRaw] = useState<Record<string, ReasoningEffort>>({});
  const [testState, setTestState] = useState<Record<string, ProviderTestState>>({});
  const [modelState, setModelState] = useState<Record<string, ProviderModelState>>(() =>
    Object.fromEntries(
      providers.map((provider) => [
        provider.id,
        { models: uniqueModels(provider.models ?? [provider.model]), loading: false },
      ]),
    ),
  );

  // Wrapper setters save to localStorage immediately when called by user actions.
  // The raw setters (above) are used by the load effect so it doesn't trigger a save.
  const setActiveProvider = useCallback((id: string) => {
    setActiveProviderRaw(id);
    if (id) window.localStorage.setItem("agenticos.activeProvider", id);
  }, []);

  const setSelectedModels = useCallback((updater: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => {
    setSelectedModelsRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      window.localStorage.setItem("agenticos.providerModels", JSON.stringify(next));
      return next;
    });
  }, []);

  const setThinking = useCallback((updater: Record<string, ThinkingLevel> | ((prev: Record<string, ThinkingLevel>) => Record<string, ThinkingLevel>)) => {
    setThinkingRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      window.localStorage.setItem("agenticos.providerThinking", JSON.stringify(next));
      return next;
    });
  }, []);

  const setEffort = useCallback((updater: Record<string, ReasoningEffort> | ((prev: Record<string, ReasoningEffort>) => Record<string, ReasoningEffort>)) => {
    setEffortRaw((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      window.localStorage.setItem("agenticos.providerEffort", JSON.stringify(next));
      return next;
    });
  }, []);

  // Load from localStorage once on mount before dynamic model refreshes can persist defaults.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    const storedProvider = window.localStorage.getItem("agenticos.activeProvider");
    const storedModels = window.localStorage.getItem("agenticos.providerModels");
    const storedThinking = window.localStorage.getItem("agenticos.providerThinking");
    const storedEffort = window.localStorage.getItem("agenticos.providerEffort");

    const initial = storedProvider || providers.find((p) => p.enabled)?.id || providers[0]?.id || "";
    if (!storedProvider && initial) window.localStorage.setItem("agenticos.activeProvider", initial);
    if (!storedModels) {
      window.localStorage.setItem("agenticos.providerModels", JSON.stringify(defaultModels));
    }

    // Defer state writes off the synchronous effect body so the React 19 lint
    // rule and concurrent-rendering invariants are happy.
    queueMicrotask(() => {
      setActiveProviderRaw(initial);
      if (storedModels) {
        setSelectedModelsRaw({ ...defaultModels, ...parseRecord<string>(storedModels) });
      } else {
        setSelectedModelsRaw(defaultModels);
      }
      if (storedThinking) setThinkingRaw(parseRecord<ThinkingLevel>(storedThinking));
      if (storedEffort) setEffortRaw(parseRecord<ReasoningEffort>(storedEffort));
    });
  }, [defaultModels, providers]);

  const testProvider = useCallback(async (provider: ModelEndpoint) => {
    setTestState((current) => ({ ...current, [provider.id]: { status: "checking" } }));
    try {
      const response = await fetch(`/api/model-providers/${provider.id}/test`, { method: "POST", cache: "no-store" });
      const body = (await response.json()) as { ok: boolean; message: string };
      setTestState((current) => ({
        ...current,
        [provider.id]: { status: body.ok ? "ok" : "error", message: body.message },
      }));
      return body.ok;
    } catch {
      setTestState((current) => ({
        ...current,
        [provider.id]: { status: "error", message: "Connection test failed" },
      }));
      return false;
    }
  }, []);

  const activateProvider = useCallback(async (provider: ModelEndpoint, model: string) => {
    const ok = await testProvider(provider);
    if (ok) {
      setSelectedModels((current) => ({ ...current, [provider.id]: model }));
      setActiveProvider(provider.id);
    }
  }, [setActiveProvider, setSelectedModels, testProvider]);

  const refreshModels = useCallback(async (provider: ModelEndpoint) => {
    setModelState((current) => ({
      ...current,
      [provider.id]: {
        models: uniqueModels(current[provider.id]?.models ?? provider.models ?? [provider.model]),
        loading: true,
      },
    }));

    try {
      const response = await fetch(`/api/model-providers/${provider.id}/models`, { cache: "no-store" });
      const body = (await response.json()) as { models?: string[]; error?: string };
      const models = uniqueModels(body.models?.length ? body.models : provider.models ?? [provider.model]);

      setModelState((current) => ({
        ...current,
        [provider.id]: { models, loading: false, error: response.ok ? undefined : body.error },
      }));
      setSelectedModels((current) => ({
        ...current,
        [provider.id]: current[provider.id] && models.includes(current[provider.id])
          ? current[provider.id]
          : getInitialModel(provider, models),
      }));
    } catch {
      setModelState((current) => ({
        ...current,
        [provider.id]: {
          models: uniqueModels(provider.models ?? [provider.model]),
          loading: false,
          error: `Could not load ${providerLabel[provider.id] ?? provider.provider} models.`,
        },
      }));
    }
  }, [setSelectedModels]);

  useEffect(() => {
    providers
      .filter((provider) => provider.dynamicModels)
      .forEach((provider) => void refreshModels(provider));
  }, [providers, refreshModels]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs">
        <span className="text-[0.58rem] uppercase tracking-[0.14em] text-[#6f6a61]">Active profile</span>
        <span className="text-[#f4f1e8]">
          {activeProvider
            ? `${providerLabel[activeProvider] ?? activeProvider} / ${selectedModels[activeProvider] ?? "model not selected"}`
            : "No provider selected"}
        </span>
      </div>
      {providers.map((provider) => {
        const state = modelState[provider.id] ?? {
          models: uniqueModels(provider.models ?? [provider.model]),
          loading: false,
        };
        const selectedModel = selectedModels[provider.id] ?? getInitialModel(provider, state.models);
        const isActive = activeProvider === provider.id;
        const isSelectable = state.models.length > 0;
        const showThinking = supportsThinking(provider);
        const showEffort = supportsEffort(provider);
        const thinkingOpts = thinkingOptionsFor(provider);
        const currentThinking = thinkingOpts.some((option) => option.value === thinking[provider.id])
          ? thinking[provider.id]
          : "off";
        const effortOptions = effortOptionsFor(provider);
        const currentEffort = effortOptions.some((option) => option.value === effort[provider.id])
          ? effort[provider.id]
          : "medium";
        const test = testState[provider.id];

        return (
          <div
            key={provider.id}
            className="space-y-2 border border-[#2a302c] bg-[#080a09] p-3 text-xs"
          >
            <div className="grid gap-3 md:grid-cols-[1fr_minmax(11rem,16rem)_auto]">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="text-[#f4f1e8]">{providerLabel[provider.id] ?? provider.provider}</div>
                  <Badge>{provider.mode}</Badge>
                  <Badge tone={isActive ? "green" : "gray"}>{isActive ? "active" : "standby"}</Badge>
                  {test?.status === "checking" ? (
                    <Badge tone="gray" className="gap-1">
                      <Loader2 size={11} className="animate-spin" /> testing…
                    </Badge>
                  ) : test?.status === "ok" ? (
                    <Badge tone="green" className="gap-1">
                      <Zap size={11} /> connected
                    </Badge>
                  ) : test?.status === "error" ? (
                    <Badge tone="red" className="gap-1">
                      <WifiOff size={11} /> unreachable
                    </Badge>
                  ) : null}
                  {provider.requiresApiKey ? (
                    <Badge tone="orange" className="gap-1">
                      <KeyRound size={11} /> key
                    </Badge>
                  ) : null}
                  {showThinking && currentThinking !== "off" ? (
                    <Badge tone="orange" className="gap-1">
                      <Brain size={11} /> {currentThinking}
                    </Badge>
                  ) : null}
                  {showEffort ? (
                    <Badge tone="orange" className="gap-1">
                      <Sparkles size={11} /> {currentEffort}
                    </Badge>
                  ) : null}
                </div>
                <div className="mt-1 truncate text-[#6f6a61]">
                  {provider.baseUrl ? provider.baseUrl : provider.provider}
                </div>
                <div className="mt-1 truncate text-[0.62rem] text-[#f4f1e8]">
                  Selected model: <span className="text-[#e86f3a]">{selectedModel || "none"}</span>
                </div>
                {state.error ? <div className="mt-2 text-[#c99a45]">{state.error}</div> : null}
                {test?.status === "error" && test.message ? (
                  <div className="mt-1 text-[#c96060]">{test.message}</div>
                ) : test?.status === "ok" && test.message ? (
                  <div className="mt-1 text-[#5a9e6f]">{test.message}</div>
                ) : null}
              </div>

              {isSelectable ? (
                <select
                  value={selectedModel}
                  onChange={(event) =>
                    setSelectedModels((current) => ({ ...current, [provider.id]: event.target.value }))
                  }
                  className="h-9 w-full rounded-[3px] border border-[#30342c] bg-[#111310] px-2 text-[0.65rem] text-[#f4f1e8] outline-none transition focus:border-[#e86f3a]"
                >
                  {state.models.map((model, index) => (
                    <option key={`${provider.id}-${model}-${index}`} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex h-9 items-center border border-[#2a302c] bg-[#111310] px-2 text-[0.65rem] text-[#6f6a61]">
                  {selectedModel}
                </div>
              )}

              <div className="flex gap-2 md:justify-end">
                {provider.dynamicModels ? (
                  <Button
                    type="button"
                    onClick={() => void refreshModels(provider)}
                    disabled={state.loading}
                    aria-label={`Refresh ${providerLabel[provider.id] ?? provider.provider} models`}
                    className="w-9 px-0"
                    title="Refresh models"
                  >
                    <RefreshCw size={14} className={state.loading ? "animate-spin" : undefined} />
                  </Button>
                ) : null}
                <Button
                  type="button"
                  onClick={() => void activateProvider(provider, selectedModel)}
                  disabled={isActive || test?.status === "checking"}
                  className="min-w-28"
                >
                  {test?.status === "checking" ? <Loader2 size={14} className="animate-spin" /> : isActive ? <Check size={14} /> : null}
                  {test?.status === "checking" ? "Testing…" : isActive ? "Active" : "Activate"}
                </Button>
              </div>
            </div>

            {(showThinking || showEffort) ? (
              <div className="grid gap-3 border-t border-[#1a1f1c] pt-2 md:grid-cols-2">
                {showThinking ? (
                  <div className="flex items-center gap-2">
                    <Brain size={13} className="text-[#e86f3a]" />
                    <span className="min-w-24 text-[0.6rem] uppercase tracking-[0.14em] text-[#8b857b]">Thinking</span>
                    <select
                      value={currentThinking}
                      onChange={(event) =>
                        setThinking((current) => ({ ...current, [provider.id]: event.target.value as ThinkingLevel }))
                      }
                      className="h-8 flex-1 rounded-[3px] border border-[#30342c] bg-[#111310] px-2 text-[0.65rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                    >
                      {thinkingOpts.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} · budget {opt.budget}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
                {showEffort ? (
                  <div className="flex items-center gap-2">
                    <Sparkles size={13} className="text-[#e86f3a]" />
                    <span className="min-w-24 text-[0.6rem] uppercase tracking-[0.14em] text-[#8b857b]">Reasoning</span>
                    <select
                      value={currentEffort}
                      onChange={(event) =>
                        setEffort((current) => ({ ...current, [provider.id]: event.target.value as ReasoningEffort }))
                      }
                      className="h-8 flex-1 rounded-[3px] border border-[#30342c] bg-[#111310] px-2 text-[0.65rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
                    >
                      {effortOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
