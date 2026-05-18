/**
 * Defense-in-depth secret scrubber. Any value emitted to an LLM (tool result,
 * MCP response, error message, etc.) is run through here first.
 *
 * Two layers:
 *  1. Snapshot every secret value we know about (env + encrypted store) and
 *     replace literal matches with [REDACTED:KEY].
 *  2. Pattern-match common API-key shapes (sk-…, xoxb-…, ghp_…, AIza…, etc.)
 *     to catch keys we don't have a record of.
 */

import { readSecrets } from "@/lib/secrets/store";

const SECRET_ENV_KEY_RE =
  /^(.*_API_KEY|.*_TOKEN|.*_SECRET|.*_PASSWORD|.*_PRIVATE_KEY|GITHUB_TOKEN|STRIPE_SECRET_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|GEMINI_API_KEY|NVIDIA_API_KEY|GROK_API_KEY|XAI_API_KEY|OPENROUTER_API_KEY|FIRECRAWL_API_KEY|SHOPIFY_ACCESS_TOKEN|SLACK_BOT_TOKEN|HUBSPOT_API_KEY|PIPEDRIVE_API_TOKEN|INSTAGRAM_TOKEN|TIKTOK_ACCESS_TOKEN|GOOGLE_CLIENT_SECRET|YOUTUBE_API_KEY|AGENTICOS_AUTH_TOKEN|AGENTICOS_SECRETS_KEY)$/;

const KNOWN_PATTERNS: Array<{ re: RegExp; label: string }> = [
  { re: /sk-[A-Za-z0-9]{20,}/g, label: "OPENAI_KEY" },
  { re: /sk-ant-[A-Za-z0-9-_]{20,}/g, label: "ANTHROPIC_KEY" },
  { re: /xox[abprs]-[A-Za-z0-9-]{10,}/g, label: "SLACK_TOKEN" },
  { re: /gh[pousr]_[A-Za-z0-9]{30,}/g, label: "GITHUB_TOKEN" },
  { re: /AIza[0-9A-Za-z_-]{30,}/g, label: "GOOGLE_KEY" },
  { re: /(?:eyJ[A-Za-z0-9_-]+\.){2}[A-Za-z0-9_-]+/g, label: "JWT" },
  { re: /AKIA[0-9A-Z]{16}/g, label: "AWS_ACCESS_KEY" },
  { re: /shpat_[A-Za-z0-9]{20,}/g, label: "SHOPIFY_TOKEN" },
  { re: /fc-[A-Za-z0-9]{20,}/g, label: "FIRECRAWL_KEY" },
];

let snapshot: Array<{ value: string; key: string }> = [];
let snapshotAt = 0;
const TTL_MS = 5_000;

async function getSnapshot() {
  if (Date.now() - snapshotAt < TTL_MS && snapshot.length) return snapshot;
  const out: Array<{ value: string; key: string }> = [];
  for (const [k, v] of Object.entries(process.env)) {
    if (!v || v.length < 6) continue;
    if (!SECRET_ENV_KEY_RE.test(k)) continue;
    out.push({ value: v, key: k });
  }
  try {
    const store = await readSecrets();
    for (const r of store) {
      if (r.value && r.value.length >= 6) out.push({ value: r.value, key: r.key });
    }
  } catch {
    /* ignore */
  }
  // Replace longest values first so substrings of larger keys don't shadow them.
  out.sort((a, b) => b.value.length - a.value.length);
  snapshot = out;
  snapshotAt = Date.now();
  return snapshot;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function redactString(input: string): Promise<string> {
  let out = input;
  const snap = await getSnapshot();
  for (const { value, key } of snap) {
    if (!out.includes(value)) continue;
    out = out.split(value).join(`[REDACTED:${key}]`);
  }
  for (const { re, label } of KNOWN_PATTERNS) {
    out = out.replace(re, `[REDACTED:${label}]`);
  }
  return out;
}

export async function redact<T>(value: T): Promise<T> {
  if (value == null) return value;
  if (typeof value === "string") {
    return (await redactString(value)) as unknown as T;
  }
  if (Array.isArray(value)) {
    const next = await Promise.all(value.map((v) => redact(v)));
    return next as unknown as T;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      // Drop any field whose key matches a secret env-style name outright.
      if (SECRET_ENV_KEY_RE.test(k.toUpperCase())) {
        out[k] = `[REDACTED:${k.toUpperCase()}]`;
        continue;
      }
      out[k] = await redact(v);
    }
    return out as unknown as T;
  }
  return value;
}

export function invalidateRedactCache() {
  snapshot = [];
  snapshotAt = 0;
}

// Synchronous variant for places where async is not viable.
// Uses the most recently cached snapshot; if cache is empty, only pattern-matches.
export function redactSync<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") {
    let out: string = value;
    for (const { value: v, key } of snapshot) {
      if (out.includes(v)) out = out.split(v).join(`[REDACTED:${key}]`);
    }
    for (const { re, label } of KNOWN_PATTERNS) {
      out = out.replace(re, `[REDACTED:${label}]`);
    }
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => redactSync(v)) as unknown as T;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_ENV_KEY_RE.test(k.toUpperCase())) {
        out[k] = `[REDACTED:${k.toUpperCase()}]`;
        continue;
      }
      out[k] = redactSync(v);
    }
    return out as unknown as T;
  }
  return value;
}
// keep escapeRegex referenced so it isn't tree-shaken away — useful for future caller-supplied keys
void escapeRegex;
