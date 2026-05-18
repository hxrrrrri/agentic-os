/**
 * Encrypted secret store. AES-256-GCM. JSON-of-records persisted to
 * `.agenticos/secrets.enc`. Key material comes from AGENTICOS_SECRETS_KEY
 * (or os.userInfo().username as a weak derivation fallback — only good
 * enough to deter casual cat /file/path, NOT a security boundary).
 *
 * Use this to keep API keys out of .env.local once you have one trusted user.
 */

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";

interface SecretRecord {
  key: string;
  value: string;
  updatedAt: string;
  note?: string;
}

interface SecretsFile {
  version: 1;
  records: SecretRecord[];
}

const FILE = path.join(process.cwd(), ".agenticos", "secrets.enc");
const ENV_FILE = path.join(process.cwd(), ".env.local");
const SALT = Buffer.from("agenticos-secrets-v1", "utf8");

function deriveKey(): Buffer {
  const passphrase =
    process.env.AGENTICOS_SECRETS_KEY ??
    `${os.hostname()}::${os.userInfo().username}::agenticos`;
  return scryptSync(passphrase, SALT, 32);
}

function encryptPayload(plain: string): Buffer {
  const key = deriveKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]);
}

function decryptPayload(blob: Buffer): string {
  const key = deriveKey();
  const iv = blob.subarray(0, 12);
  const tag = blob.subarray(12, 28);
  const enc = blob.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

async function ensureDir() {
  await fsp.mkdir(path.dirname(FILE), { recursive: true });
}

export async function readSecrets(): Promise<SecretRecord[]> {
  try {
    const blob = await fsp.readFile(FILE);
    const json = decryptPayload(blob);
    const parsed = JSON.parse(json) as SecretsFile;
    return parsed.records ?? [];
  } catch {
    return [];
  }
}

export async function writeSecret(key: string, value: string, note?: string): Promise<void> {
  await ensureDir();
  const records = await readSecrets();
  const filtered = records.filter((r) => r.key !== key);
  filtered.push({ key, value, note, updatedAt: new Date().toISOString() });
  const payload: SecretsFile = { version: 1, records: filtered };
  const blob = encryptPayload(JSON.stringify(payload));
  await fsp.writeFile(FILE, blob);
}

export async function deleteSecret(key: string): Promise<void> {
  await ensureDir();
  const records = await readSecrets();
  const filtered = records.filter((r) => r.key !== key);
  const payload: SecretsFile = { version: 1, records: filtered };
  const blob = encryptPayload(JSON.stringify(payload));
  await fsp.writeFile(FILE, blob);
}

function encodeEnvValue(value: string): string {
  if (/^[A-Za-z0-9_./:@+=-]+$/.test(value)) return value;
  return JSON.stringify(value);
}

export async function upsertEnvLocal(key: string, value: string): Promise<void> {
  const existing = fs.existsSync(ENV_FILE) ? await fsp.readFile(ENV_FILE, "utf8") : "";
  const lines = existing.split(/\r?\n/);
  const encoded = `${key}=${encodeEnvValue(value)}`;
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`);
  let replaced = false;
  const next = lines.map((line) => {
    if (!keyPattern.test(line)) return line;
    replaced = true;
    return encoded;
  });

  if (!replaced) {
    if (next.length && next[next.length - 1] !== "") next.push("");
    next.push(encoded);
  }

  await fsp.writeFile(ENV_FILE, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

export async function deleteEnvLocal(key: string): Promise<void> {
  if (!fs.existsSync(ENV_FILE)) return;
  const existing = await fsp.readFile(ENV_FILE, "utf8");
  const keyPattern = new RegExp(`^\\s*${key}\\s*=`);
  const next = existing.split(/\r?\n/).filter((line) => !keyPattern.test(line));
  await fsp.writeFile(ENV_FILE, `${next.join("\n").replace(/\n+$/, "")}\n`, "utf8");
}

export async function listSecretKeys(): Promise<{ key: string; note?: string; updatedAt: string }[]> {
  const records = await readSecrets();
  return records.map(({ key, note, updatedAt }) => ({ key, note, updatedAt }));
}

let cache: Map<string, string> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5_000;

async function loadCache(): Promise<Map<string, string>> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;
  const records = await readSecrets();
  cache = new Map(records.map((r) => [r.key, r.value]));
  cacheLoadedAt = Date.now();
  return cache;
}

/** Get the secret value: env var first, then Settings secret store fallback. */
export async function getSecret(key: string): Promise<string | undefined> {
  const env = process.env[key];
  if (env) return env;
  const store = await loadCache();
  return store.get(key);
}

export function invalidateSecretsCache() {
  cache = null;
}
