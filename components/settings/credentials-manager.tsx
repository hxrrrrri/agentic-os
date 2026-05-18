"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronRight, ExternalLink, KeyRound, Loader2, Trash2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { IntegrationCategory, IntegrationField, IntegrationSpec } from "@/lib/integrations/registry";

interface EnrichedSpec extends IntegrationSpec {
  configured: boolean;
  requiredStatus: Array<{ key: string; set: boolean }>;
  optionalStatus: Array<{ key: string; set: boolean }>;
}

interface RegistryPayload {
  integrations: EnrichedSpec[];
}

const CATEGORY_ORDER: IntegrationCategory[] = ["model", "research", "content", "social", "business", "dev", "ops"];

const CATEGORY_LABEL: Record<IntegrationCategory, string> = {
  model: "Model providers",
  research: "Research",
  content: "Content",
  social: "Social",
  business: "Business",
  dev: "Developer",
  ops: "Ops + notifications",
};

interface FormState {
  [integrationId: string]: { open: boolean; values: Record<string, string>; saving: boolean; testStatus?: "idle" | "ok" | "fail" | "checking"; testMessage?: string; lastSaved?: number };
}

export function CredentialsManager() {
  const [data, setData] = useState<RegistryPayload | null>(null);
  const [form, setForm] = useState<FormState>({});

  const reload = () =>
    fetch("/api/integrations/registry")
      .then((r) => r.json())
      .then((d: RegistryPayload) => setData(d))
      .catch(() => {});

  useEffect(() => {
    reload();
  }, []);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<[IntegrationCategory, EnrichedSpec[]]>;
    const map = new Map<IntegrationCategory, EnrichedSpec[]>();
    for (const spec of data.integrations) {
      const list = map.get(spec.category) ?? [];
      list.push(spec);
      map.set(spec.category, list);
    }
    return CATEGORY_ORDER.filter((c) => map.has(c)).map((c) => [c, map.get(c)!] as const);
  }, [data]);

  const toggle = (id: string) => {
    setForm((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { values: {}, saving: false }),
        open: !(prev[id]?.open ?? false),
      },
    }));
  };

  const updateField = (id: string, key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      [id]: {
        ...(prev[id] ?? { open: true, saving: false, values: {} }),
        values: { ...(prev[id]?.values ?? {}), [key]: value },
      },
    }));
  };

  const save = async (spec: EnrichedSpec) => {
    const state = form[spec.id];
    if (!state) return;
    setForm((p) => ({ ...p, [spec.id]: { ...state, saving: true } }));
    const entries = Object.entries(state.values).filter(([, v]) => v.trim().length > 0);
    let savedKeys = 0;
    for (const [key, value] of entries) {
      const res = await fetch("/api/secrets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: value.trim(), note: `${spec.name} (saved from Settings)` }),
      });
      if (res.ok) savedKeys++;
    }
    setForm((p) => ({
      ...p,
      [spec.id]: {
        ...state,
        saving: false,
        values: {}, // clear sensitive values from memory after save
        lastSaved: savedKeys,
      },
    }));
    await reload();
  };

  const clearOne = async (key: string) => {
    if (!confirm(`Delete the stored secret for ${key}?`)) return;
    await fetch("/api/secrets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
    await reload();
  };

  const test = async (spec: EnrichedSpec) => {
    if (!spec.testEndpoint) return;
    setForm((p) => ({
      ...p,
      [spec.id]: {
        ...(p[spec.id] ?? { open: true, saving: false, values: {} }),
        testStatus: "checking",
        testMessage: undefined,
      },
    }));
    try {
      const res = await fetch(spec.testEndpoint.path, {
        method: spec.testEndpoint.method,
        headers: { "Content-Type": "application/json" },
        body: spec.testEndpoint.body ? JSON.stringify(spec.testEndpoint.body) : undefined,
      });
      const data = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string; error?: string; user?: unknown };
      const ok = res.ok && data.ok !== false;
      setForm((p) => ({
        ...p,
        [spec.id]: {
          ...(p[spec.id] ?? { open: true, saving: false, values: {} }),
          testStatus: ok ? "ok" : "fail",
          testMessage: data.message ?? data.error ?? (ok ? "Reachable" : `HTTP ${res.status}`),
        },
      }));
    } catch (err) {
      setForm((p) => ({
        ...p,
        [spec.id]: {
          ...(p[spec.id] ?? { open: true, saving: false, values: {} }),
          testStatus: "fail",
          testMessage: err instanceof Error ? err.message : "Test failed",
        },
      }));
    }
  };

  if (!data) {
    return <div className="p-4 text-sm text-[#6f6a61]">Loading integrations…</div>;
  }

  return (
    <div className="space-y-5">
      <p className="text-[0.78rem] leading-5 text-[#a8a29a]">
        Toggle an integration to expand its credentials form. Values are stored in the encrypted secret store at <code className="text-[#e86f3a]">.agenticos/secrets.enc</code> and mirrored into <code className="text-[#e86f3a]">.env.local</code>. Restart the dev server after saving if an integration reads environment variables during startup.
      </p>

      {grouped.map(([category, specs]) => (
        <div key={category} className="space-y-2">
          <div className="terminal-label">{CATEGORY_LABEL[category]}</div>
          <div className="grid gap-2">
            {specs.map((spec) => {
              const state = form[spec.id] ?? { open: false, values: {}, saving: false };
              return (
                <div key={spec.id} className="rounded-[3px] border border-[#2a302c] bg-[#080a09]">
                  <button
                    type="button"
                    onClick={() => toggle(spec.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      {state.open ? <ChevronDown size={11} className="shrink-0 text-[#6f6a61]" /> : <ChevronRight size={11} className="shrink-0 text-[#6f6a61]" />}
                      <span className="truncate text-sm font-semibold text-[#f4f1e8]">{spec.name}</span>
                      <Badge tone={spec.configured ? "green" : "gray"}>{spec.configured ? "configured" : "unset"}</Badge>
                    </div>
                    <span className="hidden truncate text-[0.66rem] text-[#6f6a61] sm:inline">{spec.description}</span>
                  </button>

                  {state.open ? (
                    <div className="space-y-3 border-t border-[#2a302c] p-3">
                      <p className="text-[0.7rem] leading-5 text-[#a8a29a]">{spec.description}</p>
                      {spec.docsUrl ? (
                        <a
                          href={spec.docsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-[0.16em] text-[#e86f3a] hover:underline"
                        >
                          Open docs <ExternalLink size={9} />
                        </a>
                      ) : null}

                      <div className="space-y-2">
                        {[...spec.fields.map((f) => ({ ...f, required: true })), ...(spec.optionalFields ?? []).map((f) => ({ ...f, required: false }))].map((field) => (
                          <FieldRow
                            key={field.key}
                            field={field}
                            isSet={
                              spec.requiredStatus.find((s) => s.key === field.key)?.set ||
                              spec.optionalStatus.find((s) => s.key === field.key)?.set ||
                              false
                            }
                            value={state.values[field.key] ?? ""}
                            onChange={(v) => updateField(spec.id, field.key, v)}
                            onClear={() => clearOne(field.key)}
                            required={field.required}
                          />
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => save(spec)}
                          disabled={state.saving}
                          className="inline-flex h-7 items-center gap-2 rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] px-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] hover:bg-[#251914] disabled:opacity-50"
                        >
                          {state.saving ? <Loader2 size={11} className="animate-spin" /> : <KeyRound size={11} />}
                          Save credentials
                        </button>
                        {spec.testEndpoint ? (
                          <button
                            type="button"
                            onClick={() => test(spec)}
                            disabled={!spec.configured || state.testStatus === "checking"}
                            className="inline-flex h-7 items-center gap-2 rounded-[3px] border border-[#2a302c] bg-[#10120f] px-3 text-[0.62rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-50"
                          >
                            {state.testStatus === "checking" ? <Loader2 size={11} className="animate-spin" /> : null}
                            Test
                          </button>
                        ) : null}
                        {state.testStatus === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-[0.66rem] text-[#9fc39b]">
                            <CheckCircle2 size={11} /> {state.testMessage ?? "Reachable"}
                          </span>
                        ) : null}
                        {state.testStatus === "fail" ? (
                          <span className="inline-flex items-center gap-1 text-[0.66rem] text-[#d9827d]">
                            <XCircle size={11} /> {state.testMessage ?? "Failed"}
                          </span>
                        ) : null}
                        {state.lastSaved !== undefined ? (
                          <span className="inline-flex items-center gap-1 text-[0.66rem] text-[#79a875]">
                            <CheckCircle2 size={11} /> Saved {state.lastSaved} value{state.lastSaved === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldRow({
  field,
  isSet,
  value,
  onChange,
  onClear,
  required,
}: {
  field: IntegrationField;
  isSet: boolean;
  value: string;
  onChange: (next: string) => void;
  onClear: () => void;
  required: boolean;
}) {
  return (
    <div className="rounded-[2px] border border-[#2a302c] bg-[#10120f] p-2">
      <div className="flex items-center justify-between gap-2">
        <label className="text-[0.66rem] uppercase tracking-[0.16em] text-[#a8a29a]">
          {field.label} <span className="text-[#6f6a61]">{required ? "(required)" : "(optional)"}</span>
          <span className="ml-2 font-mono text-[0.6rem] text-[#6f6a61]">{field.key}</span>
        </label>
        <div className="flex items-center gap-2">
          <Badge tone={isSet ? "green" : "gray"}>{isSet ? "set" : "unset"}</Badge>
          {isSet ? (
            <button
              type="button"
              onClick={onClear}
              aria-label="Delete this secret"
              title="Delete this secret"
              className="inline-flex h-5 w-5 items-center justify-center rounded-[2px] border border-[#2a302c] bg-[#10120f] text-[#6f6a61] hover:border-[#d9827d] hover:text-[#d9827d]"
            >
              <Trash2 size={9} />
            </button>
          ) : null}
        </div>
      </div>
      <input
        type={field.type === "password" ? "password" : "text"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={isSet ? "•".repeat(8) + " (stored, leave blank to keep)" : field.placeholder ?? ""}
        className="mt-2 w-full rounded-[2px] border border-[#2a302c] bg-[#0b0d0a] px-2 py-1 text-[0.74rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
        autoComplete="off"
        spellCheck={false}
      />
      {field.helpText ? <p className="mt-1 text-[0.6rem] text-[#6f6a61]">{field.helpText}</p> : null}
    </div>
  );
}
