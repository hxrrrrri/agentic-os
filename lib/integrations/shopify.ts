/**
 * Shopify Admin API read adapter.
 * Requires SHOPIFY_SHOP_DOMAIN (e.g. mystore.myshopify.com) and
 * SHOPIFY_ADMIN_TOKEN (Admin API access token).
 *
 * Writes (refunds, fulfillment, customer mutate) deliberately omitted —
 * those must be approval-gated when added.
 */

import { getSecret } from "@/lib/secrets/store";

const API_VERSION = "2024-10";

async function shopify<T>(path: string): Promise<T> {
  const domain = await getSecret("SHOPIFY_SHOP_DOMAIN");
  const token = await getSecret("SHOPIFY_ADMIN_TOKEN");
  if (!domain || !token) throw new Error("SHOPIFY_SHOP_DOMAIN / SHOPIFY_ADMIN_TOKEN not set");
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}${path}`, {
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Shopify ${path} -> ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export interface ShopifyShop {
  id: number;
  name: string;
  email: string;
  currency: string;
  plan_name: string;
  domain: string;
}

export async function getShop() {
  return (await shopify<{ shop: ShopifyShop }>("/shop.json")).shop;
}

export interface ShopifyOrder {
  id: number;
  order_number: number;
  total_price: string;
  currency: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer?: { email: string | null; first_name: string | null; last_name: string | null };
  created_at: string;
}

export async function listOrders(limit = 25, status: "any" | "open" | "closed" | "cancelled" = "any") {
  return (await shopify<{ orders: ShopifyOrder[] }>(`/orders.json?limit=${limit}&status=${status}`)).orders;
}

export interface ShopifyProduct {
  id: number;
  title: string;
  vendor: string;
  product_type: string;
  status: "active" | "draft" | "archived";
  created_at: string;
}

export async function listProducts(limit = 50) {
  return (await shopify<{ products: ShopifyProduct[] }>(`/products.json?limit=${limit}`)).products;
}

// ---- writes (approval-gated; call only from executor) ------------------------

async function shopifyWrite<T>(path: string, body: Record<string, unknown>, method: "POST" | "PUT" = "POST"): Promise<T> {
  const domain = await getSecret("SHOPIFY_SHOP_DOMAIN");
  const token = await getSecret("SHOPIFY_ADMIN_TOKEN");
  if (!domain || !token) throw new Error("SHOPIFY_SHOP_DOMAIN / SHOPIFY_ADMIN_TOKEN not set");
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}${path}`, {
    method,
    headers: { "X-Shopify-Access-Token": token, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function cancelOrder(orderId: number | string, options: { email?: boolean; reason?: string } = {}) {
  return shopifyWrite(`/orders/${orderId}/cancel.json`, {
    email: options.email ?? false,
    reason: options.reason ?? "other",
  });
}
