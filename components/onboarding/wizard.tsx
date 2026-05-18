"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, ChevronRight, ChevronLeft, AlertTriangle, Rocket } from "lucide-react";
import { AgenticOsLogo } from "@/components/layout/agenticos-logo";

interface OnboardData {
  model: Record<string, boolean>;
  integrations: Record<string, boolean>;
  security: { authToken: boolean; secretsKey: boolean };
  runtime: { mode: string; provider: string; vaultPath: string; databasePath: string };
  providers: Array<{ id: string; name: string }>;
}

const STEPS = [
  { key: "welcome", title: "Welcome" },
  { key: "model", title: "Model Provider" },
  { key: "security", title: "Security" },
  { key: "integrations", title: "Integrations" },
  { key: "notifications", title: "Notifications" },
  { key: "ready", title: "Ready" },
] as const;

type StepKey = (typeof STEPS)[number]["key"];

export function OnboardingWizard() {
  const [data, setData] = useState<OnboardData | null>(null);
  const [step, setStep] = useState<StepKey>("welcome");

  useEffect(() => {
    fetch("/api/onboarding")
      .then((r) => r.json())
      .then((d: OnboardData) => setData(d))
      .catch(() => {});
  }, []);

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  const modelReady = useMemo(() => Object.values(data?.model ?? {}).some(Boolean), [data]);
  const integrationCount = useMemo(
    () => Object.values(data?.integrations ?? {}).filter(Boolean).length,
    [data],
  );
  const notifReady = useMemo(
    () => Boolean(data?.integrations.ntfy || data?.integrations.slack || data?.integrations.discord),
    [data],
  );

  const goNext = () => {
    if (stepIndex < STEPS.length - 1) setStep(STEPS[stepIndex + 1].key);
  };
  const goBack = () => {
    if (stepIndex > 0) setStep(STEPS[stepIndex - 1].key);
  };

  return (
    <div className="min-h-screen bg-[#0c0e0b] p-6">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center gap-3">
          <AgenticOsLogo className="h-10 w-10" />
          <div>
            <div className="text-[20px] font-black tracking-[0.16em] text-[#f4f1e8]">
              AGENTIC<span className="text-[#e86f3a]">OS</span>
            </div>
            <div className="text-[0.66rem] uppercase tracking-[0.18em] text-[#6f6a61]">First-run setup</div>
          </div>
        </div>

        <ol className="mt-6 flex items-center justify-between text-[0.6rem] uppercase tracking-[0.16em]">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1">
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                  i <= stepIndex
                    ? "border-[#e86f3a] bg-[#1d1612] text-[#e86f3a]"
                    : "border-[#2a302c] bg-[#10120f] text-[#6f6a61]"
                }`}
              >
                {i + 1}
              </span>
              <span className={i === stepIndex ? "text-[#e86f3a]" : "text-[#6f6a61]"}>{s.title}</span>
              {i < STEPS.length - 1 ? <ChevronRight size={11} className="text-[#3d4239]" /> : null}
            </li>
          ))}
        </ol>

        <div className="mt-6 rounded-[3px] border border-[#2a302c] bg-[#10120f] p-5">
          {step === "welcome" ? (
            <div>
              <h2 className="text-2xl font-bold text-[#f4f1e8]">Get AgenticOS production-ready in five minutes.</h2>
              <p className="mt-3 text-sm text-[#a8a29a]">
                This wizard walks you through model selection, secret storage, integrations, and notification routing. None of
                it leaves your machine.
              </p>
              <ul className="mt-4 space-y-2 text-[0.78rem] text-[#a8a29a]">
                <li>• Pick a default model provider (NVIDIA, OpenAI, Anthropic, Ollama, etc.)</li>
                <li>• Lock the dashboard with a session token</li>
                <li>• Connect the integrations you actually use</li>
                <li>• Route approvals + run completions to ntfy / Slack / Discord</li>
              </ul>
            </div>
          ) : step === "model" ? (
            <div>
              <h2 className="text-xl font-bold text-[#f4f1e8]">Model provider</h2>
              <p className="mt-2 text-sm text-[#a8a29a]">
                Detected keys in <code className="text-[#e86f3a]">.env.local</code>:
              </p>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-[0.78rem]">
                {Object.entries(data?.model ?? {}).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2">
                    {v ? <CheckCircle2 size={13} className="text-[#79a875]" /> : <Circle size={13} className="text-[#6f6a61]" />}
                    <span className="uppercase tracking-[0.12em]">{k}</span>
                  </li>
                ))}
              </ul>
              {!modelReady ? (
                <div className="mt-3 flex items-center gap-2 text-[0.72rem] text-[#c99a45]">
                  <AlertTriangle size={12} /> Add at least one model API key to <code>.env.local</code>, then restart{" "}
                  <code>npm run dev</code>.
                </div>
              ) : null}
              <p className="mt-4 text-[0.7rem] text-[#6f6a61]">
                Default provider env var <code className="text-[#e86f3a]">AGENTICOS_PROVIDER</code>: current value{" "}
                <span className="text-[#f4f1e8]">{data?.runtime.provider}</span>.
              </p>
            </div>
          ) : step === "security" ? (
            <div>
              <h2 className="text-xl font-bold text-[#f4f1e8]">Security</h2>
              <ul className="mt-3 space-y-2 text-[0.78rem]">
                <li className="flex items-center gap-2">
                  {data?.security.authToken ? (
                    <CheckCircle2 size={13} className="text-[#79a875]" />
                  ) : (
                    <Circle size={13} className="text-[#6f6a61]" />
                  )}
                  Session lock — <code>AGENTICOS_AUTH_TOKEN</code> {data?.security.authToken ? "set" : "unset"}
                </li>
                <li className="flex items-center gap-2">
                  {data?.security.secretsKey ? (
                    <CheckCircle2 size={13} className="text-[#79a875]" />
                  ) : (
                    <Circle size={13} className="text-[#6f6a61]" />
                  )}
                  Encrypted secrets passphrase — <code>AGENTICOS_SECRETS_KEY</code>{" "}
                  {data?.security.secretsKey ? "set" : "unset (will use hostname+user fallback)"}
                </li>
              </ul>
              <p className="mt-3 text-[0.72rem] text-[#a8a29a]">
                Add both to <code>.env.local</code> if anyone else can reach this machine. The wizard does not write env vars
                for you — that file is your responsibility.
              </p>
            </div>
          ) : step === "integrations" ? (
            <div>
              <h2 className="text-xl font-bold text-[#f4f1e8]">Integrations</h2>
              <p className="mt-2 text-sm text-[#a8a29a]">{integrationCount} integration credential(s) detected.</p>
              <ul className="mt-3 grid grid-cols-2 gap-2 text-[0.78rem]">
                {Object.entries(data?.integrations ?? {}).map(([k, v]) => (
                  <li key={k} className="flex items-center gap-2">
                    {v ? <CheckCircle2 size={13} className="text-[#79a875]" /> : <Circle size={13} className="text-[#6f6a61]" />}
                    <span className="uppercase tracking-[0.12em]">{k}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : step === "notifications" ? (
            <div>
              <h2 className="text-xl font-bold text-[#f4f1e8]">Notifications</h2>
              <ul className="mt-3 space-y-2 text-[0.78rem]">
                <li className="flex items-center gap-2">
                  {data?.integrations.ntfy ? (
                    <CheckCircle2 size={13} className="text-[#79a875]" />
                  ) : (
                    <Circle size={13} className="text-[#6f6a61]" />
                  )}
                  ntfy push for approvals — <code>NTFY_TOPIC</code>
                </li>
                <li className="flex items-center gap-2">
                  {data?.integrations.slack ? (
                    <CheckCircle2 size={13} className="text-[#79a875]" />
                  ) : (
                    <Circle size={13} className="text-[#6f6a61]" />
                  )}
                  Slack webhook — <code>SLACK_WEBHOOK_URL</code>
                </li>
                <li className="flex items-center gap-2">
                  {data?.integrations.discord ? (
                    <CheckCircle2 size={13} className="text-[#79a875]" />
                  ) : (
                    <Circle size={13} className="text-[#6f6a61]" />
                  )}
                  Discord webhook — <code>DISCORD_WEBHOOK_URL</code>
                </li>
              </ul>
              {!notifReady ? (
                <p className="mt-3 text-[0.72rem] text-[#6f6a61]">
                  Skip if you do not want push notifications. You can wire any time.
                </p>
              ) : null}
            </div>
          ) : step === "ready" ? (
            <div>
              <h2 className="flex items-center gap-2 text-2xl font-bold text-[#f4f1e8]">
                <Rocket size={20} className="text-[#e86f3a]" />
                Ready to launch.
              </h2>
              <p className="mt-3 text-sm text-[#a8a29a]">
                Mode: <span className="text-[#f4f1e8]">{data?.runtime.mode}</span> · Provider:{" "}
                <span className="text-[#f4f1e8]">{data?.runtime.provider}</span> · Vault:{" "}
                <code className="text-[#e86f3a]">{data?.runtime.vaultPath}</code>
              </p>
              <div className="mt-4 flex gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex h-9 items-center rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] px-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] hover:bg-[#251914]"
                >
                  Open dashboard
                </Link>
                <Link
                  href="/docs"
                  className="inline-flex h-9 items-center rounded-[3px] border border-[#2a302c] bg-[#10120f] px-4 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#e86f3a]"
                >
                  Read docs
                </Link>
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={stepIndex === 0}
            className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-[#2a302c] bg-[#10120f] px-3 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#a8a29a] hover:border-[#e86f3a] hover:text-[#e86f3a] disabled:opacity-30"
          >
            <ChevronLeft size={11} /> Back
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={stepIndex === STEPS.length - 1}
            className="inline-flex h-8 items-center gap-2 rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] px-3 text-[0.66rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] hover:bg-[#251914] disabled:opacity-30"
          >
            Next <ChevronRight size={11} />
          </button>
        </div>
      </div>
    </div>
  );
}
