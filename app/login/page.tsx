"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgenticOsLogo } from "@/components/layout/agenticos-logo";

export default function LoginPage() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") ?? "/dashboard";
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as { ok: boolean; error?: string };
      if (!data.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(from);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#000000] p-6">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-[3px] border border-[#2a302c] bg-[#10120f] p-6"
      >
        <div className="flex items-center gap-3">
          <AgenticOsLogo className="h-10 w-10" />
          <div className="text-[20px] font-black tracking-[0.16em] text-[#f4f1e8]">
            AGENTIC<span className="text-[#e86f3a]">OS</span>
          </div>
        </div>
        <p className="mt-4 text-[0.72rem] uppercase tracking-[0.18em] text-[#6f6a61]">Session unlock</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="AGENTICOS_AUTH_TOKEN"
          className="mt-3 w-full rounded-[2px] border border-[#2a302c] bg-[#0b0d0a] px-3 py-2 text-sm text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
          autoFocus
        />
        {error ? <div className="mt-3 text-[0.72rem] text-[#e86f3a]">{error}</div> : null}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 inline-flex h-9 w-full items-center justify-center rounded-[3px] border border-[#e86f3a]/60 bg-[#1d1612] text-[0.7rem] font-bold uppercase tracking-[0.14em] text-[#e86f3a] transition hover:bg-[#251914] disabled:opacity-50"
        >
          {pending ? "Unlocking..." : "Unlock"}
        </button>
        <p className="mt-3 text-[0.65rem] text-[#6f6a61]">
          Set AGENTICOS_AUTH_TOKEN in .env.local. Leave it unset for legacy open-mode (single user on localhost).
        </p>
      </form>
    </div>
  );
}
