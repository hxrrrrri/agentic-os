import { NextResponse } from "next/server";
import { z } from "zod";
import { addTask, readTasks, toggleTask } from "@/lib/command-center/tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostSchema = z.union([
  z.object({ action: z.literal("toggle"), id: z.string().min(1) }),
  z.object({ action: z.literal("add"), label: z.string().min(1).max(280) }),
]);

export async function GET() {
  try {
    const tasks = await readTasks();
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = PostSchema.parse(await request.json());
    const tasks = body.action === "toggle" ? await toggleTask(body.id) : await addTask(body.label);
    return NextResponse.json({ tasks });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 400 },
    );
  }
}
