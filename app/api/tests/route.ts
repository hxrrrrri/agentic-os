import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import fsp from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vitest can take a while on first run; tell Next not to time us out early.
export const maxDuration = 300;

const REPO_ROOT = process.cwd();
const RESULTS_FILE = path.join(REPO_ROOT, "tests", ".last-results.json");

interface VitestResult {
  numTotalTestSuites: number;
  numPassedTestSuites: number;
  numFailedTestSuites: number;
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  numPendingTests: number;
  startTime: number;
  testResults: Array<{
    name: string;
    status: string;
    message?: string;
    assertionResults: Array<{
      ancestorTitles: string[];
      title: string;
      fullName: string;
      status: string;
      failureMessages?: string[];
      duration?: number | null;
    }>;
  }>;
}

export async function GET() {
  try {
    const raw = await fsp.readFile(RESULTS_FILE, "utf8");
    const parsed = JSON.parse(raw) as VitestResult;
    return NextResponse.json({ ok: true, results: parsed });
  } catch {
    return NextResponse.json({ ok: true, results: null });
  }
}

function resolveVitestCli(): string | null {
  // Prefer the vitest binary inside this repo's node_modules so we sidestep
  // npm.cmd/PATH issues on Windows.
  const candidates = [
    path.join(REPO_ROOT, "node_modules", "vitest", "vitest.mjs"),
    path.join(REPO_ROOT, "node_modules", "vitest", "dist", "cli.js"),
    path.join(REPO_ROOT, "node_modules", "vitest", "dist", "cli-wrapper.js"),
  ];
  return candidates[0] ?? null;
}

export async function POST() {
  return new Promise<Response>((resolve) => {
    const cliPath = resolveVitestCli();

    const args = cliPath
      ? [cliPath, "run", "--reporter=default", "--reporter=json", `--outputFile.json=${RESULTS_FILE}`]
      : null;

    if (!args) {
      resolve(
        NextResponse.json(
          {
            ok: false,
            error: "Vitest is not installed. Run `npm install` in the project root first.",
            results: null,
          },
          { status: 500 },
        ),
      );
      return;
    }

    const child = spawn(process.execPath, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, CI: "true", FORCE_COLOR: "0" },
      shell: false,
    });

    let stdout = "";
    let stderr = "";
    const cap = 16_000;
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
      if (stdout.length > cap) stdout = stdout.slice(-cap);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > cap) stderr = stderr.slice(-cap);
    });
    child.on("error", (err) => {
      resolve(
        NextResponse.json(
          {
            ok: false,
            error: err.message,
            results: null,
            stdout,
            stderr,
          },
          { status: 500 },
        ),
      );
    });
    child.on("close", async (code) => {
      let results: VitestResult | null = null;
      try {
        const raw = await fsp.readFile(RESULTS_FILE, "utf8");
        results = JSON.parse(raw);
      } catch {
        // results file missing — vitest may not have produced one
      }
      resolve(
        NextResponse.json({
          ok: code === 0,
          exitCode: code,
          results,
          stdout,
          stderr,
        }),
      );
    });
  });
}
