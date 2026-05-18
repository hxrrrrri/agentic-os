/**
 * Stripe read adapter (scaffold). Requires STRIPE_SECRET_KEY.
 * Writes (refund / subscription cancel) are intentionally NOT exported here
 * — those must go through the approval queue when implemented.
 */

import { getSecret } from "@/lib/secrets/store";

const API = "https://api.stripe.com/v1";

async function stripe<T>(p: string): Promise<T> {
  const key = await getSecret("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const res = await fetch(`${API}${p}`, {
    headers: { Authorization: `Bearer ${key}`, "Stripe-Version": "2024-06-20" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Stripe ${p} -> ${res.status}`);
  return res.json() as Promise<T>;
}

export interface StripeBalance {
  available: Array<{ amount: number; currency: string }>;
  pending: Array<{ amount: number; currency: string }>;
}

export async function getBalance() {
  return stripe<StripeBalance>("/balance");
}

export interface StripeCharge {
  id: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
  description: string | null;
  receipt_url: string | null;
}

export async function recentCharges(limit = 20) {
  return stripe<{ data: StripeCharge[] }>(`/charges?limit=${limit}`);
}

export interface StripeSubscription {
  id: string;
  status: string;
  current_period_end: number;
  customer: string;
  items: { data: Array<{ price: { unit_amount: number; currency: string; recurring: { interval: string } | null } }> };
}

export async function activeSubscriptions(limit = 20) {
  return stripe<{ data: StripeSubscription[] }>(`/subscriptions?status=active&limit=${limit}`);
}

// ---- writes (approval-gated; call only from executor) ------------------------

async function stripeWrite<T>(p: string, body: URLSearchParams, method: "POST" | "DELETE" = "POST"): Promise<T> {
  const key = await getSecret("STRIPE_SECRET_KEY");
  if (!key) throw new Error("STRIPE_SECRET_KEY not set");
  const res = await fetch(`${API}${p}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Stripe ${p} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function refundCharge(chargeId: string, amount?: number, reason?: string) {
  const body = new URLSearchParams({ charge: chargeId });
  if (amount) body.set("amount", String(amount));
  if (reason) body.set("reason", reason);
  return stripeWrite<{ id: string; amount: number; status: string }>("/refunds", body, "POST");
}

export async function cancelSubscription(subscriptionId: string) {
  return stripeWrite<{ id: string; status: string }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}`,
    new URLSearchParams(),
    "DELETE",
  );
}
