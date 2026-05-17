import type { Metadata } from "next";
import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/layout/command-palette";
import { startScheduler } from "@/lib/scheduler/worker";
import { indexVaultGraph } from "@/lib/vault/graph";

export const metadata: Metadata = {
  title: "AgenticOS",
  description: "Local-first AI operating system for agentic workflows.",
  icons: {
    icon: "/agenticos-logo.png",
    apple: "/agenticos-logo.png",
  },
};

void startScheduler().catch(() => {});
void indexVaultGraph().catch(() => {});

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
