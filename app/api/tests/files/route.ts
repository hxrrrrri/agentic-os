import { NextResponse } from "next/server";
import fsp from "node:fs/promises";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function walk(dir: string, base: string): Promise<string[]> {
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full, base)));
    } else if (/\.test\.[tj]sx?$/.test(entry.name)) {
      out.push(path.relative(base, full).replaceAll("\\", "/"));
    }
  }
  return out;
}

export async function GET() {
  const root = path.join(process.cwd(), "tests");
  const files = await walk(root, process.cwd());
  return NextResponse.json({ files: files.sort() });
}
