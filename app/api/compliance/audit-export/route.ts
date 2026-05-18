import { exportAuditCsv } from "@/lib/compliance/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const csv = await exportAuditCsv();
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
