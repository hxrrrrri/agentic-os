import { NextResponse } from "next/server";
import { INTEGRATIONS } from "@/lib/integrations/registry";
import { getSecret } from "@/lib/secrets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const enriched = await Promise.all(
    INTEGRATIONS.map(async (spec) => {
      const required = spec.fields;
      const optional = spec.optionalFields ?? [];
      const requiredStatus = await Promise.all(
        required.map(async (f) => ({ key: f.key, set: Boolean(await getSecret(f.key)) })),
      );
      const optionalStatus = await Promise.all(
        optional.map(async (f) => ({ key: f.key, set: Boolean(await getSecret(f.key)) })),
      );
      const configured = requiredStatus.every((s) => s.set);
      return {
        ...spec,
        configured,
        requiredStatus,
        optionalStatus,
      };
    }),
  );
  return NextResponse.json({ integrations: enriched });
}
