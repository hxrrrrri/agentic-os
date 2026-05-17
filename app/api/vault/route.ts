import { NextResponse } from "next/server";
import { z } from "zod";
import { createDailyNote, listVaultFiles, getRecentVaultFiles, writeVaultMarkdown } from "@/lib/vault/service";
import { indexGeneratedArtifact } from "@/lib/memory/indexer";

export const runtime = "nodejs";

const CreateNoteSchema = z.object({
  folder: z.string().default("drafts"),
  title: z.string().min(1),
  body: z.string().default(""),
  daily: z.boolean().optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") ?? "";
  const files = await listVaultFiles(path);
  const recent = await getRecentVaultFiles();
  return NextResponse.json({ files, recent });
}

export async function POST(request: Request) {
  const body = CreateNoteSchema.parse(await request.json());
  const filePath = body.daily
    ? await createDailyNote(body.body)
    : await writeVaultMarkdown(body.folder, body.title, `# ${body.title}\n\n${body.body}\n`);
  await indexGeneratedArtifact(filePath, `Manual note: ${body.title}`, ["manual"]);
  return NextResponse.json({ filePath }, { status: 201 });
}
