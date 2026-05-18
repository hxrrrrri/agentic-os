/**
 * Pipedrive read adapter.
 * Requires PIPEDRIVE_API_TOKEN and (optionally) PIPEDRIVE_DOMAIN
 * (e.g. mycompany — used in https://<domain>.pipedrive.com).
 */

import { getSecret } from "@/lib/secrets/store";

async function pipedrive<T>(path: string): Promise<T> {
  const token = await getSecret("PIPEDRIVE_API_TOKEN");
  const domain = (await getSecret("PIPEDRIVE_DOMAIN")) ?? "api";
  if (!token) throw new Error("PIPEDRIVE_API_TOKEN not set");
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`https://${domain}.pipedrive.com/api/v1${path}${sep}api_token=${encodeURIComponent(token)}`, {
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Pipedrive ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface PipedrivePerson {
  id: number;
  name: string;
  email?: Array<{ value: string }>;
  org_name?: string | null;
}

export async function listPersons(limit = 25) {
  return (await pipedrive<{ data: PipedrivePerson[] | null }>(`/persons?limit=${limit}`)).data ?? [];
}

export interface PipedriveDeal {
  id: number;
  title: string;
  value: number;
  currency: string;
  status: string;
  stage_id: number;
  add_time: string;
}

export async function listDeals(limit = 25) {
  return (await pipedrive<{ data: PipedriveDeal[] | null }>(`/deals?limit=${limit}&status=open`)).data ?? [];
}
