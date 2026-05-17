import { NextResponse } from "next/server";
import { indexVaultGraph } from "@/lib/vault/graph";
import {
  getBacklinks,
  getGraphStats,
  getMostLinkedNodes,
  getOrphanNodes,
  getOutlinks,
} from "@/lib/db/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") ?? "stats";
  const notePath = searchParams.get("path") ?? "";

  try {
    if (action === "stats") {
      const stats = await getGraphStats();
      return NextResponse.json(stats);
    }
    if (action === "orphans") {
      const limit = Math.min(100, Number(searchParams.get("limit") ?? "20"));
      const nodes = await getOrphanNodes(limit);
      return NextResponse.json({ nodes });
    }
    if (action === "top") {
      const limit = Math.min(50, Number(searchParams.get("limit") ?? "10"));
      const nodes = await getMostLinkedNodes(limit);
      return NextResponse.json({ nodes });
    }
    if (action === "backlinks" && notePath) {
      const [backlinks, outlinks] = await Promise.all([
        getBacklinks(notePath),
        getOutlinks(notePath),
      ]);
      return NextResponse.json({ backlinks, outlinks });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const result = await indexVaultGraph();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Index failed" },
      { status: 500 },
    );
  }
}
