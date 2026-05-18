/**
 * Salesforce JWT bearer flow + read adapter.
 *
 * Required env vars:
 *   SALESFORCE_CLIENT_ID         — Connected App consumer key
 *   SALESFORCE_USERNAME          — login of the integration user
 *   SALESFORCE_PRIVATE_KEY       — PEM RSA private key matching the Connected
 *                                  App certificate (newlines as \n if pasted)
 *   SALESFORCE_LOGIN_URL         — e.g. https://login.salesforce.com or
 *                                  https://test.salesforce.com (sandbox).
 *                                  Defaults to https://login.salesforce.com.
 *   SALESFORCE_INSTANCE_URL      — (optional) cached instance URL; if missing
 *                                  we use the one returned from the token call.
 *
 * Setup checklist (one-time, on Salesforce):
 *   1. Create a Connected App with "Use digital signatures" enabled.
 *   2. Upload your X.509 cert (matching the private key you put in env).
 *   3. Add the OAuth scopes "api refresh_token offline_access" (or whatever
 *      you need).
 *   4. Pre-authorize the integration user / profile.
 */

import { createSign } from "node:crypto";
import { getSecret } from "@/lib/secrets/store";

interface TokenCache {
  accessToken: string;
  instanceUrl: string;
  expiresAt: number;
}

let cache: TokenCache | null = null;

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64").replaceAll("=", "").replaceAll("+", "-").replaceAll("/", "_");
}

async function signJwt(): Promise<string> {
  const clientId = await getSecret("SALESFORCE_CLIENT_ID");
  const username = await getSecret("SALESFORCE_USERNAME");
  const privateKey = (await getSecret("SALESFORCE_PRIVATE_KEY"))?.replaceAll("\\n", "\n");
  const audience = (await getSecret("SALESFORCE_LOGIN_URL")) ?? "https://login.salesforce.com";
  if (!clientId || !username || !privateKey) {
    throw new Error("Missing SALESFORCE_CLIENT_ID / SALESFORCE_USERNAME / SALESFORCE_PRIVATE_KEY");
  }
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: clientId,
      sub: username,
      aud: audience,
      exp: Math.floor(Date.now() / 1000) + 180,
    }),
  );
  const data = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(data);
  signer.end();
  const signature = base64url(signer.sign(privateKey));
  return `${data}.${signature}`;
}

async function exchangeJwtForAccessToken(): Promise<TokenCache> {
  const audience = (await getSecret("SALESFORCE_LOGIN_URL")) ?? "https://login.salesforce.com";
  const assertion = await signJwt();
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });
  const res = await fetch(`${audience}/services/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Salesforce JWT exchange failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token: string; instance_url: string };
  return {
    accessToken: json.access_token,
    instanceUrl: json.instance_url,
    // SF tokens normally last 2 hours; cache slightly under that.
    expiresAt: Date.now() + 110 * 60_000,
  };
}

export async function getSalesforceToken(): Promise<TokenCache> {
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache;
  cache = await exchangeJwtForAccessToken();
  return cache;
}

export function clearSalesforceCache() {
  cache = null;
}

async function sf<T>(path: string): Promise<T> {
  const { accessToken, instanceUrl } = await getSalesforceToken();
  const res = await fetch(`${instanceUrl}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Salesforce ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface SfAccount {
  Id: string;
  Name: string;
  Industry: string | null;
  CreatedDate: string;
}

export async function listAccounts(limit = 25): Promise<SfAccount[]> {
  const result = await sf<{ records: SfAccount[] }>(
    `/services/data/v60.0/query?q=${encodeURIComponent(`SELECT Id, Name, Industry, CreatedDate FROM Account ORDER BY CreatedDate DESC LIMIT ${limit}`)}`,
  );
  return result.records;
}

export interface SfOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
}

export async function listOpenOpportunities(limit = 25): Promise<SfOpportunity[]> {
  const result = await sf<{ records: SfOpportunity[] }>(
    `/services/data/v60.0/query?q=${encodeURIComponent(
      `SELECT Id, Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false ORDER BY CloseDate ASC LIMIT ${limit}`,
    )}`,
  );
  return result.records;
}
