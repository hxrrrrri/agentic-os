"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@/components/ui/button";

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  async function resolve(status: "approved" | "rejected") {
    await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    router.refresh();
  }
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => startTransition(() => resolve("approved"))} className="border-[#79a875] text-[#9fc39b]">Approve</Button>
      <Button disabled={pending} onClick={() => startTransition(() => resolve("rejected"))} className="border-[#c4605a] text-[#d9827d]">Reject</Button>
    </div>
  );
}
