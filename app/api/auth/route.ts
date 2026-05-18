import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const COOKIE = "agenticos_session";
const Schema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const expected = process.env.AGENTICOS_AUTH_TOKEN;
  if (!expected) {
    return NextResponse.json({ ok: true, message: "Auth not configured — open mode" });
  }
  let body: { token: string };
  try {
    body = Schema.parse(await request.json());
  } catch {
    return NextResponse.json({ ok: false, error: "Missing token" }, { status: 400 });
  }
  if (body.token !== expected) {
    return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, expected, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  return NextResponse.json({ required: Boolean(process.env.AGENTICOS_AUTH_TOKEN) });
}
