"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

interface PatchResponse {
  executionError?: string;
  executed?: unknown;
}

export function ApprovalActions({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function resolve(status: "approved" | "rejected") {
    setError(null);
    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    const data = (await res.json().catch(() => ({}))) as PatchResponse;
    if (data.executionError) {
      setError(data.executionError);
      // still refresh so the row updates to whatever the server recorded
    }
    router.refresh();
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          disabled={pending}
          onClick={() => startTransition(() => resolve("approved"))}
          className="border-[#79a875] text-[#9fc39b]"
        >
          Approve
        </Button>
        <Button
          disabled={pending}
          onClick={() => startTransition(() => resolve("rejected"))}
          className="border-[#c4605a] text-[#d9827d]"
        >
          Reject
        </Button>
      </div>
      {error ? (
        <div className="max-w-xs text-right text-[0.7rem] text-[#d9827d]">
          Execution failed: {error}
        </div>
      ) : null}
    </div>
  );
}
