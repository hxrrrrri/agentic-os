import { NextResponse, type NextRequest } from "next/server";

// Shared-secret session auth.
// Set AGENTICOS_AUTH_TOKEN in .env.local to enable. When unset, everything is
// open (preserves the legacy local-first dev experience).
const TOKEN = process.env.AGENTICOS_AUTH_TOKEN;
const COOKIE = "agenticos_session";

const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/api/slack", // Slack signature is verified inside the handler
  "/agenticos-logo.png",
  "/favicon.ico",
];

function isPublic(pathname: string) {
  if (pathname.startsWith("/_next/")) return true;
  if (pathname.startsWith("/static/")) return true;
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export function proxy(req: NextRequest) {
  const headers = new Headers(req.headers);
  headers.set("x-agenticos-path", req.nextUrl.pathname);

  if (!TOKEN) return NextResponse.next({ request: { headers } });
  if (isPublic(req.nextUrl.pathname)) return NextResponse.next({ request: { headers } });

  const session = req.cookies.get(COOKIE)?.value;
  if (session && session === TOKEN) return NextResponse.next({ request: { headers } });

  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
