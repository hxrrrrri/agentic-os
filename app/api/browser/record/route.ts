import { NextResponse } from "next/server";
import { z } from "zod";
import { compileTraceToSkillPrompt, deleteTrace, getTrace, listTraces, markCompiled, saveTrace, type TraceStep } from "@/lib/browser/recorder";
import { writeVaultMarkdown } from "@/lib/vault/service";
import { slugify } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TraceStepSchema = z.object({
  type: z.enum(["click", "fill", "navigate", "wait", "select", "press", "extract"]),
  selector: z.string().optional(),
  value: z.string().optional(),
  url: z.string().optional(),
  description: z.string().optional(),
});

const PostSchema = z.object({
  name: z.string().min(1).max(160),
  startUrl: z.string().url().optional(),
  steps: z.array(TraceStepSchema).min(1).max(400),
});

const CompileSchema = z.object({ id: z.string().min(1) });
const DeleteSchema = z.object({ id: z.string().min(1) });

export async function GET() {
  const traces = await listTraces();
  return NextResponse.json({ traces });
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const trace = await saveTrace(body.name, body.startUrl, body.steps as TraceStep[]);
    return NextResponse.json({ ok: true, trace }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  // Compile a trace into a vault-stored skill markdown.
  try {
    const body = CompileSchema.parse(await request.json());
    const trace = await getTrace(body.id);
    if (!trace) return NextResponse.json({ ok: false, error: "Trace not found" }, { status: 404 });
    const markdown = compileTraceToSkillPrompt(trace);
    const skillId = `trace-${slugify(trace.name)}-${trace.id.slice(-6)}`;
    const path = await writeVaultMarkdown("skills", skillId, markdown, {
      frontmatter: {
        tags: ["skill", "browser-trace"],
        category: "custom",
        traceId: trace.id,
      },
    });
    await markCompiled(trace.id, skillId);
    return NextResponse.json({ ok: true, skillId, path });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    await deleteTrace(body.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Bad request" }, { status: 400 });
  }
}
