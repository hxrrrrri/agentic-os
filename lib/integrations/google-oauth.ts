/**
 * Google OAuth refresh-token helper.
 *
 * Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN. This
 * exchanges the refresh token for a short-lived access token, cached in
 * memory until just before expiry.
 *
 * Use the returned access token for Gmail, Calendar, Drive, YouTube Analytics.
 */

import { getSecret } from "@/lib/secrets/store";

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

let cache: CachedToken | null = null;

export async function getGoogleAccessToken(): Promise<string> {
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache.accessToken;

  const clientId = await getSecret("GOOGLE_CLIENT_ID");
  const clientSecret = await getSecret("GOOGLE_CLIENT_SECRET");
  const refreshToken = await getSecret("GOOGLE_REFRESH_TOKEN");
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Google token exchange failed (${res.status}): ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { access_token: string; expires_in: number };
  cache = { accessToken: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 };
  return cache.accessToken;
}

export function clearGoogleTokenCache() {
  cache = null;
}

export function googleOAuthInstallUrl(scopes: string[]): string {
  // For first-time setup: open this URL in a browser, copy the code, and
  // exchange for a refresh token via the standard Google OAuth code flow.
  const clientId = process.env.GOOGLE_CLIENT_ID ?? "";
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: "urn:ietf:wg:oauth:2.0:oob",
    response_type: "code",
    scope: scopes.join(" "),
    access_type: "offline",
    prompt: "consent",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}
