import { NextResponse } from "next/server";
import { listContacts as listHubspotContacts, listDeals as listHubspotDeals } from "@/lib/integrations/hubspot";
import { listPersons as listPipedrivePersons, listDeals as listPipedriveDeals } from "@/lib/integrations/pipedrive";
import { listAccounts as listSfAccounts, listOpenOpportunities } from "@/lib/integrations/salesforce";
import { getSecret } from "@/lib/secrets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function detectProvider(): Promise<"hubspot" | "pipedrive" | "salesforce" | null> {
  if (await getSecret("HUBSPOT_ACCESS_TOKEN")) return "hubspot";
  if (await getSecret("PIPEDRIVE_API_TOKEN")) return "pipedrive";
  if (await getSecret("SALESFORCE_CLIENT_ID")) return "salesforce";
  return null;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const provider = url.searchParams.get("provider") as "hubspot" | "pipedrive" | "salesforce" | null;
  const mode = url.searchParams.get("mode") ?? "contacts";

  try {
    const resolvedProvider = provider ?? (await detectProvider());

    if (!resolvedProvider) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "No CRM credentials configured (HUBSPOT_ACCESS_TOKEN, PIPEDRIVE_API_TOKEN, or SALESFORCE_CLIENT_ID + SALESFORCE_USERNAME + SALESFORCE_PRIVATE_KEY)",
        },
        { status: 503 },
      );
    }

    if (resolvedProvider === "hubspot") {
      if (mode === "deals") return NextResponse.json({ ok: true, provider: "hubspot", deals: await listHubspotDeals() });
      return NextResponse.json({ ok: true, provider: "hubspot", contacts: await listHubspotContacts() });
    }

    if (resolvedProvider === "pipedrive") {
      if (mode === "deals") return NextResponse.json({ ok: true, provider: "pipedrive", deals: await listPipedriveDeals() });
      return NextResponse.json({ ok: true, provider: "pipedrive", contacts: await listPipedrivePersons() });
    }

    if (resolvedProvider === "salesforce") {
      if (mode === "deals")
        return NextResponse.json({ ok: true, provider: "salesforce", deals: await listOpenOpportunities() });
      return NextResponse.json({ ok: true, provider: "salesforce", contacts: await listSfAccounts() });
    }

    return NextResponse.json({ ok: false, error: "Unsupported provider" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "CRM read failed" },
      { status: 500 },
    );
  }
}
