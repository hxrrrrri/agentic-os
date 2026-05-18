import { NextResponse } from "next/server";
import { z } from "zod";
import { getBalance, recentCharges, activeSubscriptions } from "@/lib/integrations/stripe";
import { proposeAction } from "@/lib/approvals/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RefundSchema = z.object({
  mode: z.literal("refund"),
  chargeId: z.string().min(1),
  amount: z.number().int().positive().optional(),
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
});

const CancelSubSchema = z.object({
  mode: z.literal("cancel-subscription"),
  subscriptionId: z.string().min(1),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("mode") ?? "balance";
  try {
    if (mode === "balance") return NextResponse.json({ ok: true, balance: await getBalance() });
    if (mode === "charges") return NextResponse.json({ ok: true, charges: (await recentCharges()).data });
    if (mode === "subscriptions")
      return NextResponse.json({ ok: true, subscriptions: (await activeSubscriptions()).data });
    return NextResponse.json({ ok: false, error: "Unknown mode" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Stripe failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (body?.mode === "refund") {
      const parsed = RefundSchema.parse(body);
      const approval = await proposeAction({
        action: `Stripe refund ${parsed.chargeId}${parsed.amount ? ` for ${parsed.amount}` : ""}`,
        integration: "stripe",
        affectedResource: parsed.chargeId,
        commandOrPayload: JSON.stringify({ chargeId: parsed.chargeId, amount: parsed.amount, reason: parsed.reason }),
        riskLevel: "critical",
        explanation: "Refunds money. Approve to execute the Stripe API call.",
      });
      return NextResponse.json({ ok: true, queued: true, approvalId: approval.id });
    }
    if (body?.mode === "cancel-subscription") {
      const parsed = CancelSubSchema.parse(body);
      const approval = await proposeAction({
        action: `Stripe cancel subscription ${parsed.subscriptionId}`,
        integration: "stripe",
        affectedResource: parsed.subscriptionId,
        commandOrPayload: JSON.stringify({ subscriptionId: parsed.subscriptionId }),
        riskLevel: "critical",
        explanation: "Cancels a customer subscription. Approve to execute.",
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
