import { NextResponse } from "next/server";
import { listSkills } from "@/lib/skills/registry";

export async function GET() {
  return NextResponse.json({ skills: listSkills() });
}
