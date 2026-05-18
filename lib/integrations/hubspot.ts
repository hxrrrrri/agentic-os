/**
 * HubSpot read adapter (CRM contacts + deals).
 * Requires HUBSPOT_ACCESS_TOKEN (private app access token).
 */

import { getSecret } from "@/lib/secrets/store";

const API = "https://api.hubapi.com";

async function hubspot<T>(path: string): Promise<T> {
  const token = await getSecret("HUBSPOT_ACCESS_TOKEN");
  if (!token) throw new Error("HUBSPOT_ACCESS_TOKEN not set");
  const res = await fetch(`${API}${path}`, {
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HubSpot ${path} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface HubspotContact {
  id: string;
  properties: { email?: string; firstname?: string; lastname?: string; createdate?: string; lifecyclestage?: string };
}

export async function listContacts(limit = 25) {
  const json = await hubspot<{ results: HubspotContact[] }>(
    `/crm/v3/objects/contacts?limit=${limit}&properties=email,firstname,lastname,createdate,lifecyclestage`,
  );
  return json.results;
}

export interface HubspotDeal {
  id: string;
  properties: { dealname?: string; amount?: string; dealstage?: string; closedate?: string; pipeline?: string };
}

export async function listDeals(limit = 25) {
  const json = await hubspot<{ results: HubspotDeal[] }>(
    `/crm/v3/objects/deals?limit=${limit}&properties=dealname,amount,dealstage,closedate,pipeline`,
  );
  return json.results;
}
