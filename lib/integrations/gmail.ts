/**
 * Gmail read scaffold. Lists recent inbox messages via OAuth.
 * Compose/send paths intentionally omitted — must approval-gate before any
 * send.
 */

import { getGoogleAccessToken } from "@/lib/integrations/google-oauth";

const API = "https://gmail.googleapis.com/gmail/v1";

interface GmailListResponse {
  messages?: Array<{ id: string; threadId: string }>;
  resultSizeEstimate?: number;
}

interface GmailMessage {
  id: string;
  snippet: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
  };
  internalDate?: string;
}

async function gmail<T>(p: string): Promise<T> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Gmail ${p} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface InboxItem {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  receivedAt: string;
}

function headerVal(msg: GmailMessage, name: string): string {
  return msg.payload?.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";
}

// ---- writes (approval-gated; call only from executor) ------------------------

function rfc822(to: string, subject: string, body: string, from?: string): string {
  const headers = [
    `To: ${to}`,
    from ? `From: ${from}` : "",
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ].filter(Boolean);
  return `${headers.join("\r\n")}\r\n\r\n${body}`;
}

function base64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll(/=+$/g, "");
}

export async function createDraft(to: string, subject: string, body: string, from?: string) {
  const token = await getGoogleAccessToken();
  const message = rfc822(to, subject, body, from);
  const res = await fetch(`${API}/users/me/drafts`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { raw: base64Url(message) } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Gmail create-draft -> ${res.status}`);
  return res.json() as Promise<{ id: string; message: { id: string } }>;
}

export async function sendMessage(to: string, subject: string, body: string, from?: string) {
  const token = await getGoogleAccessToken();
  const message = rfc822(to, subject, body, from);
  const res = await fetch(`${API}/users/me/messages/send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: base64Url(message) }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Gmail send -> ${res.status}`);
  return res.json() as Promise<{ id: string; labelIds: string[] }>;
}

export async function listRecentInbox(maxResults = 15): Promise<InboxItem[]> {
  const listing = await gmail<GmailListResponse>(`/users/me/messages?maxResults=${maxResults}&labelIds=INBOX`);
  if (!listing.messages?.length) return [];
  const details = await Promise.all(
    listing.messages.map((m) =>
      gmail<GmailMessage>(`/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`),
    ),
  );
  return details.map((d) => ({
    id: d.id,
    from: headerVal(d, "From"),
    subject: headerVal(d, "Subject"),
    snippet: d.snippet,
    receivedAt: d.internalDate ? new Date(Number(d.internalDate)).toISOString() : "",
  }));
}
