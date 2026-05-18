import type { Metadata } from "next";
import { cookies, headers } from "next/headers";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/layout/command-palette";
import { ensureBoot } from "@/lib/boot";

export const metadata: Metadata = {
  title: "AgenticOS",
  description: "Local-first AI operating system for agentic workflows.",
  icons: {
    icon: "/agenticos-logo.png",
    apple: "/agenticos-logo.png",
  },
};

// Single boot entry point — kicks off scheduler, vault indexer, and stale-run
// recovery once per Node process. Replaces the previous fan-out at module-load
// which ran heavy work on every cold start regardless of route.
ensureBoot();

const SHELL_FREE_ROUTES = ["/login", "/onboard"];
const VALID_THEMES = ["dark", "light", "contrast"] as const;
type ValidTheme = (typeof VALID_THEMES)[number];

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const headerList = await headers();
  const cookieStore = await cookies();
  const pathname = headerList.get("x-agenticos-path") ?? "";
  const shellFree = SHELL_FREE_ROUTES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const cookieTheme = cookieStore.get("agenticos-theme")?.value;
  const theme: ValidTheme = (VALID_THEMES as readonly string[]).includes(cookieTheme ?? "")
    ? (cookieTheme as ValidTheme)
    : "dark";
  const wideShell = pathname === "/command-center" || pathname.startsWith("/command-center/");

  return (
    <html lang="en" data-theme={theme}>
      <body>
        {shellFree ? children : <AppShell wide={wideShell}>{children}</AppShell>}
        {shellFree ? null : <CommandPalette />}
      </body>
    </html>
  );
}
