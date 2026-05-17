"use client";

import { useEffect, useState } from "react";
import { Play, RotateCw, CheckCircle2, XCircle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AssertionResult {
  ancestorTitles: string[];
  title: string;
  fullName: string;
  status: string;
  failureMessages?: string[];
  duration?: number | null;
}

interface SuiteResult {
  name: string;
  status: string;
  message?: string;
  assertionResults: AssertionResult[];
}

interface VitestResult {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  testResults: SuiteResult[];
}

interface RunPayload {
  ok: boolean;
  exitCode?: number;
  results: VitestResult | null;
  stdout?: string;
  stderr?: string;
}

export function TestsPanel() {
  const [files, setFiles] = useState<string[]>([]);
  const [results, setResults] = useState<VitestResult | null>(null);
  const [running, setRunning] = useState(false);
  const [stdout, setStdout] = useState<string>("");
  const [stderr, setStderr] = useState<string>("");

  useEffect(() => {
    fetch("/api/tests/files")
      .then((r) => r.json())
      .then((d: { files: string[] }) => setFiles(d.files))
      .catch(() => {});
    fetch("/api/tests")
      .then((r) => r.json())
      .then((d: { results: VitestResult | null }) => setResults(d.results))
      .catch(() => {});
  }, []);

  const runTests = async () => {
    setRunning(true);
    setStdout("");
    setStderr("");
    try {
      const res = await fetch("/api/tests", { method: "POST" });
      const text = await res.text();
      let data: RunPayload | null = null;
      try {
        data = text ? (JSON.parse(text) as RunPayload) : null;
      } catch {
        setStderr(`Non-JSON response (HTTP ${res.status}):\n${text.slice(0, 4000)}`);
        return;
      }
      if (!data) {
        setStderr(`Empty response (HTTP ${res.status})`);
        return;
      }
      setResults(data.results);
      setStdout(data.stdout ?? "");
      setStderr(data.stderr ?? (data.ok ? "" : (data as RunPayload & { error?: string }).error ?? ""));
    } catch (err) {
      setStderr(err instanceof Error ? err.message : "Run failed");
    } finally {
      setRunning(false);
    }
  };

  const failedAssertions = (results?.testResults ?? [])
    .flatMap((s) => s.assertionResults)
    .filter((a) => a.status === "failed");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-[0.18em] text-[#8b857b]">Test Runner</div>
            <h1 className="mt-1 text-xl font-black tracking-[0.04em] text-[#f4f1e8]">Audit Suite</h1>
            <p className="mt-1 text-sm text-[#a8a29a]">
              Vitest-backed unit suite covering vault, permissions, skills, scheduler, utils, and integrations.
            </p>
          </div>
          <button
            type="button"
            onClick={runTests}
            disabled={running}
            className="inline-flex h-9 items-center gap-2 rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] px-4 text-xs font-bold uppercase tracking-[0.14em] text-[#e86f3a] transition hover:bg-[#251914] disabled:opacity-50"
          >
            {running ? <RotateCw size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? "Running" : "Run all tests"}
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Suites" value={results ? `${results.numPassedTestSuites}/${results.numTotalTestSuites}` : "—"} />
          <Stat label="Tests" value={results ? `${results.numPassedTests}/${results.numTotalTests}` : "—"} />
          <Stat label="Failed" value={results ? results.numFailedTests : "—"} tone={results && results.numFailedTests > 0 ? "red" : "green"} />
          <Stat label="Pending" value={results ? results.numPendingTests : "—"} />
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#8b857b]">Test files</div>
          <ul className="mt-3 space-y-1 text-[0.8rem] text-[#f4f1e8]">
            {files.length === 0 ? (
              <li className="text-[#6f6a61]">No .test.ts files found.</li>
            ) : (
              files.map((f) => (
                <li key={f} className="flex items-center gap-2">
                  <Clock size={11} className="text-[#6f6a61]" />
                  <span className="font-mono">{f}</span>
                </li>
              ))
            )}
          </ul>
        </Card>

        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#8b857b]">Recent results</div>
          {results === null ? (
            <p className="mt-3 text-sm text-[#6f6a61]">
              No results yet. Click <strong>Run all tests</strong> or run <code className="font-mono">npm test</code> in a terminal.
            </p>
          ) : (
            <ul className="mt-3 space-y-2 text-[0.8rem]">
              {results.testResults.map((suite) => {
                const failed = suite.assertionResults.filter((a) => a.status === "failed").length;
                const passed = suite.assertionResults.filter((a) => a.status === "passed").length;
                return (
                  <li key={suite.name} className="flex items-start gap-2 text-[#f4f1e8]">
                    {failed === 0 ? (
                      <CheckCircle2 size={13} className="mt-[2px] text-[#79a875]" />
                    ) : (
                      <XCircle size={13} className="mt-[2px] text-[#e86f3a]" />
                    )}
                    <div className="min-w-0">
                      <div className="truncate font-mono text-[0.74rem]">{suite.name.replace(process.cwd(), "")}</div>
                      <div className="text-[0.66rem] text-[#8b857b]">
                        {passed} passed · {failed} failed
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      {failedAssertions.length > 0 ? (
        <Card className="p-5">
          <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-[#e86f3a]">
            <XCircle size={12} /> Failures
          </div>
          <ul className="mt-3 space-y-3 text-[0.74rem] text-[#f4f1e8]">
            {failedAssertions.map((a, i) => (
              <li key={`${a.fullName}-${i}`} className="rounded-[2px] border border-[#5a1818]/40 bg-[#1a1010] p-3">
                <div className="font-bold">{a.fullName}</div>
                {a.failureMessages?.length ? (
                  <pre className="mt-2 whitespace-pre-wrap text-[0.7rem] text-[#a8a29a]">{a.failureMessages.join("\n\n")}</pre>
                ) : null}
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {stdout || stderr ? (
        <Card className="p-5">
          <div className="text-xs uppercase tracking-[0.18em] text-[#8b857b]">Run output</div>
          {stdout ? (
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-[2px] bg-[#0b0d0a] p-3 text-[0.7rem] text-[#a8a29a]">{stdout}</pre>
          ) : null}
          {stderr ? (
            <pre className="mt-3 max-h-48 overflow-auto whitespace-pre-wrap rounded-[2px] border border-[#5a1818]/30 bg-[#1a1010] p-3 text-[0.7rem] text-[#e86f3a]">{stderr}</pre>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "green" | "red";
}) {
  const color =
    tone === "red"
      ? "text-[#e86f3a]"
      : tone === "green"
        ? "text-[#79a875]"
        : "text-[#f4f1e8]";
  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#10120f] p-3">
      <div className="text-[0.56rem] uppercase tracking-[0.18em] text-[#8b857b]">{label}</div>
      <div className={`mt-1 text-lg font-black ${color}`}>{value}</div>
      {tone ? <Badge tone={tone} className="mt-2 text-[0.5rem]">{tone === "red" ? "needs fix" : "passing"}</Badge> : null}
    </div>
  );
}
