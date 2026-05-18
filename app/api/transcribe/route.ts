import { NextResponse } from "next/server";
import { transcribe } from "@/lib/integrations/whisper";
import { writeVaultMarkdown } from "@/lib/vault/service";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const title = (form.get("title") as string | null) ?? `transcript-${new Date().toISOString().slice(0, 10)}`;
    const saveToVault = (form.get("saveToVault") as string | null) !== "false";

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ ok: false, error: "Missing file" }, { status: 400 });
    }
    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json({ ok: false, error: "File over 25 MB" }, { status: 413 });
    }

    const result = await transcribe(file);
    let vaultPath: string | undefined;
    if (saveToVault) {
      vaultPath = await writeVaultMarkdown(
        "raw",
        `transcript-${slugify(title)}`,
        `# ${title}\n\n${result.text}`,
        {
          frontmatter: {
            tags: ["transcript", "audio"],
            category: "memory",
            source: result.model,
          },
        },
      );
    }

    return NextResponse.json({ ok: true, ...result, vaultPath });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Transcription failed" },
      { status: 500 },
    );
  }
}

export async function GET() {
  return NextResponse.json({
    description: "POST multipart/form-data with `file` (audio blob), optional `title`, optional `saveToVault=false`. Returns the transcript text and the vault path it was written to.",
  });
}
