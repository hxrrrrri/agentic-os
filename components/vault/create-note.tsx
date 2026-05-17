"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

export function CreateNote() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [folder, setFolder] = useState("drafts");
  const [pending, startTransition] = useTransition();
  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        startTransition(async () => {
          await fetch("/api/vault", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ title, body, folder }),
          });
          setTitle("");
          setBody("");
          router.refresh();
        });
      }}
    >
      <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="note title" className="w-full border border-[#2a302c] bg-[#080a09] p-2 text-sm outline-none focus:border-[#e86f3a]" />
      <select value={folder} onChange={(event) => setFolder(event.target.value)} className="w-full border border-[#2a302c] bg-[#080a09] p-2 text-sm outline-none">
        {["drafts", "daily", "raw", "wiki", "projects", "content", "memory"].map((item) => <option key={item}>{item}</option>)}
      </select>
      <textarea value={body} onChange={(event) => setBody(event.target.value)} placeholder="markdown body" className="min-h-28 w-full border border-[#2a302c] bg-[#080a09] p-2 text-sm outline-none focus:border-[#e86f3a]" />
      <Button disabled={!title.trim() || pending}>{pending ? "Creating" : "Create Note"}</Button>
    </form>
  );
}
