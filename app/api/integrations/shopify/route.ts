import { NextResponse } from "next/server";
import { z } from "zod";
import { getShop, listOrders, listProducts } from "@/lib/integrations/shopify";
import { proposeAction } from "@/lib/approvals/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CancelOrderSchema = z.object({
  mode: z.literal("cancel-order"),
  orderId: z.union([z.string(), z.number()]),
  email: z.boolean().optional(),
  reason: z.enum(["customer", "fraud", "inventory", "declined", "other"]).optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "shop";
  try {
    if (mode === "shop") return NextResponse.json({ ok: true, shop: await getShop() });
    if (mode === "orders") return NextResponse.json({ ok: true, orders: await listOrders() });
    if (mode === "products") return NextResponse.json({ ok: true, products: await listProducts() });
    return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Shopify read failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.mode === "cancel-order") {
      const parsed = CancelOrderSchema.parse(body);
      const approval = await proposeAction({
        action: `Shopify cancel order ${parsed.orderId}`,
        integration: "shopify",
        affectedResource: String(parsed.orderId),
        commandOrPayload: JSON.stringify({ orderId: parsed.orderId, email: parsed.email, reason: parsed.reason }),
        riskLevel: "high",
        explanation: "Cancels a Shopify order (and optionally emails the customer).",
      });
      return NextResponse.json({ ok: true, queued: true, approvalId: approval.id });
    }
    return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
