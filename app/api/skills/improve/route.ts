import { NextResponse } from "next/server";
import { z } from "zod";
import { adoptPatch, listAllGrades, listGradesForSkill, listSkillPatches } from "@/lib/skills/auto-grade";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AdoptSchema = z.object({ patchId: z.string().min(1) });

export async function GET(request: Request) {
  const url = new URL(request.url);
  const skillId = url.searchParams.get("skill") ?? undefined;
  const [grades, patches] = await Promise.all([
    skillId ? listGradesForSkill(skillId, 30) : listAllGrades(50),
    listSkillPatches(skillId ?? undefined),
  ]);
  return NextResponse.json({ grades, patches });
}

export async function POST(request: Request) {
  try {
    const body = AdoptSchema.parse(await request.json());
    await adoptPatch(body.patchId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
