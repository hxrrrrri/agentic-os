"use client";

import { Check, KeyRound, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModelEndpoint } from "@/types";

interface ProviderModelState {
  models: string[];
  loading: boolean;
  error?: string;
}

const providerLabel: Record<string, string> = {
  "claude-code": "Claude Code",
  codex: "Codex",
  ollama: "Ollama",
  nvidia: "NVIDIA",
  anthropic: "Anthropic",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  gemini: "Gemini",
  grok: "Grok",
  custom: "Custom",
};

function getInitialModel(provider: ModelEndpoint, models: string[]) {
  if (models.includes(provider.model)) {
    return provider.model;
  }

  return models[0] ?? provider.model;
}

function uniqueModels(models: string[]) {
  return Array.from(new Set(models.map((model) => model.trim()).filter(Boolean)));
}

export function ModelProviderProfiles({ providers }: { providers: ModelEndpoint[] }) {
  const defaultProvider = useMemo(
    () => providers.find((provider) => provider.enabled)?.id ?? providers[0]?.id ?? "",
    [providers],
  );
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
  const [activeProvider, setActiveProvider] = useState(defaultProvider);
  const [selectedModels, setSelectedModels] = useState<Record<string, string>>(() => {
    return defaultModels;
  });
  const [modelState, setModelState] = useState<Record<string, ProviderModelState>>(() =>
    Object.fromEntries(
      providers.map((provider) => [
        provider.id,
        { models: uniqueModels(provider.models ?? [provider.model]), loading: false },
      ]),
    ),
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const storedProvider = window.localStorage.getItem("agenticos.activeProvider");
      const storedModels = window.localStorage.getItem("agenticos.providerModels");

      if (storedProvider) {
        setActiveProvider(storedProvider);
      }

      if (storedModels) {
        try {
          setSelectedModels({
            ...defaultModels,
            ...(JSON.parse(storedModels) as Record<string, string>),
          });
        } catch {
          setSelectedModels(defaultModels);
        }
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [defaultModels]);

  useEffect(() => {
    if (activeProvider) {
      window.localStorage.setItem("agenticos.activeProvider", activeProvider);
    }
  }, [activeProvider]);

  useEffect(() => {
    window.localStorage.setItem("agenticos.providerModels", JSON.stringify(selectedModels));
  }, [selectedModels]);

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
  }, []);

  useEffect(() => {
    providers
      .filter((provider) => provider.dynamicModels)
      .forEach((provider) => void refreshModels(provider));
  }, [providers, refreshModels]);

  return (
    <div className="space-y-2">
      {providers.map((provider) => {
        const state = modelState[provider.id] ?? {
          models: uniqueModels(provider.models ?? [provider.model]),
          loading: false,
        };
        const selectedModel = selectedModels[provider.id] ?? getInitialModel(provider, state.models);
        const isActive = activeProvider === provider.id;
        const isSelectable = state.models.length > 0 && provider.mode !== "cli";

        return (
          <div
            key={provider.id}
            className="grid gap-3 border border-[#2a302c] bg-[#080a09] p-3 text-xs md:grid-cols-[1fr_minmax(12rem,18rem)_auto]"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-[#f4f1e8]">{providerLabel[provider.id] ?? provider.provider}</div>
                <Badge>{provider.mode}</Badge>
                <Badge tone={isActive ? "green" : "gray"}>{isActive ? "active" : "standby"}</Badge>
                {provider.requiresApiKey ? (
                  <Badge tone="orange" className="gap-1">
                    <KeyRound size={11} /> key
                  </Badge>
                ) : null}
              </div>
              <div className="mt-1 truncate text-[#6f6a61]">
                {provider.baseUrl ? provider.baseUrl : provider.provider}
              </div>
              {state.error ? <div className="mt-2 text-[#c99a45]">{state.error}</div> : null}
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
                onClick={() => setActiveProvider(provider.id)}
                disabled={isActive}
                className="min-w-28"
              >
                {isActive ? <Check size={14} /> : null}
                {isActive ? "Active" : "Activate"}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
