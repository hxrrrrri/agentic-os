import { NextResponse } from "next/server";
import { z } from "zod";
import { deleteEnvLocal, deleteSecret, invalidateSecretsCache, listSecretKeys, upsertEnvLocal, writeSecret } from "@/lib/secrets/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PutSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[A-Z0-9_]+$/, "Use uppercase env-style keys"),
  value: z.string().min(1).max(8192),
  note: z.string().max(280).optional(),
});

const DeleteSchema = z.object({ key: z.string().min(1).max(128) });

export async function GET() {
  return NextResponse.json({ keys: await listSecretKeys() });
}

export async function PUT(request: Request) {
  try {
    const body = PutSchema.parse(await request.json());
    await writeSecret(body.key, body.value, body.note);
    await upsertEnvLocal(body.key, body.value);
    process.env[body.key] = body.value;
    invalidateSecretsCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const body = DeleteSchema.parse(await request.json());
    await deleteSecret(body.key);
    await deleteEnvLocal(body.key);
    delete process.env[body.key];
    invalidateSecretsCache();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
