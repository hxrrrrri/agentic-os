"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function RoutineActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  async function patch(body: Record<string, unknown>) {
    await fetch("/api/routines", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...body }),
    });
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => startTransition(() => patch({ enabled: !enabled }))}>{enabled ? "Disable" : "Enable"}</Button>
      <Button disabled={pending} onClick={() => startTransition(() => patch({ runNow: true }))} className="border-[#e86f3a] text-[#e86f3a]">Run Now</Button>
    </div>
  );
}
