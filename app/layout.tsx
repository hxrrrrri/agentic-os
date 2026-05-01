import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/layout/command-palette";

export const metadata: Metadata = {
  title: "AgenticOS",
  description: "Local-first AI operating system for agentic workflows.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
        <CommandPalette />
      </body>
    </html>
  );
}
