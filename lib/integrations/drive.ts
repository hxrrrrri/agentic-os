/**
 * Google Drive read adapter. Uses the OAuth refresh-token helper.
 */

import { getGoogleAccessToken } from "@/lib/integrations/google-oauth";

const API = "https://www.googleapis.com/drive/v3";

async function drive<T>(path: string): Promise<T> {
  const token = await getGoogleAccessToken();
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Drive ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  modifiedTime?: string;
  size?: string;
  owners?: Array<{ displayName: string; emailAddress: string }>;
}

export async function listRecentFiles(pageSize = 25): Promise<DriveFile[]> {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: "modifiedTime desc",
    fields: "files(id, name, mimeType, webViewLink, modifiedTime, size, owners(displayName,emailAddress))",
  });
  const json = await drive<{ files: DriveFile[] }>(`/files?${params.toString()}`);
  return json.files ?? [];
}

export async function searchFiles(query: string, pageSize = 20): Promise<DriveFile[]> {
  const q = `name contains '${query.replaceAll("'", "\\'")}' and trashed = false`;
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    q,
    fields: "files(id, name, mimeType, webViewLink, modifiedTime)",
  });
  const json = await drive<{ files: DriveFile[] }>(`/files?${params.toString()}`);
  return json.files ?? [];
}
