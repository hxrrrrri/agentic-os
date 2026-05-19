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

// ---- search + full body for tool-use loop ------------------------------------

export interface GmailMessageFull extends InboxItem {
  to: string;
  threadId: string;
  bodyText: string;
  labels: string[];
}

interface GmailMessagePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: GmailMessagePart[];
}

interface GmailMessageFullResp {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailMessagePart & { headers?: Array<{ name: string; value: string }> };
}

function decodeBase64Url(data?: string): string {
  if (!data) return "";
  try {
    return Buffer.from(data.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractBodyText(part?: GmailMessagePart): string {
  if (!part) return "";
  if (part.mimeType?.startsWith("text/plain") && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts?.length) {
    const plain = part.parts.find((p) => p.mimeType === "text/plain");
    if (plain?.body?.data) return decodeBase64Url(plain.body.data);
    for (const child of part.parts) {
      const found = extractBodyText(child);
      if (found) return found;
    }
  }
  if (part.body?.data) return decodeBase64Url(part.body.data);
  return "";
}

/** Search Gmail by query (e.g. "is:unread newer_than:1d"). Returns full body
 *  text capped at 8k chars per message. Returns null when Gmail is not
 *  configured. */
export async function searchGmail(query: string, maxResults = 15): Promise<GmailMessageFull[] | null> {
  try {
    const listing = await gmail<GmailListResponse>(
      `/users/me/messages?q=${encodeURIComponent(query)}&maxResults=${Math.min(50, Math.max(1, maxResults))}`,
    );
    if (!listing.messages?.length) return [];
    const details = await Promise.all(
      listing.messages.map((m) => gmail<GmailMessageFullResp>(`/users/me/messages/${m.id}?format=full`)),
    );
    return details.map((d) => ({
      id: d.id,
      threadId: d.threadId,
      from: d.payload?.headers?.find((h) => h.name.toLowerCase() === "from")?.value ?? "",
      to: d.payload?.headers?.find((h) => h.name.toLowerCase() === "to")?.value ?? "",
      subject: d.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "",
      snippet: d.snippet ?? "",
      receivedAt: d.internalDate ? new Date(Number(d.internalDate)).toISOString() : "",
      bodyText: extractBodyText(d.payload).slice(0, 8000),
      labels: d.labelIds ?? [],
    }));
  } catch {
    return null;
  }
}

export async function getGmailMessageFull(id: string): Promise<GmailMessageFull | null> {
  try {
    const d = await gmail<GmailMessageFullResp>(`/users/me/messages/${id}?format=full`);
    return {
      id: d.id,
      threadId: d.threadId,
      from: d.payload?.headers?.find((h) => h.name.toLowerCase() === "from")?.value ?? "",
      to: d.payload?.headers?.find((h) => h.name.toLowerCase() === "to")?.value ?? "",
      subject: d.payload?.headers?.find((h) => h.name.toLowerCase() === "subject")?.value ?? "",
      snippet: d.snippet ?? "",
      receivedAt: d.internalDate ? new Date(Number(d.internalDate)).toISOString() : "",
      bodyText: extractBodyText(d.payload).slice(0, 20_000),
      labels: d.labelIds ?? [],
    };
  } catch {
    return null;
  }
}
