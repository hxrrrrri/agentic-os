"use client";

import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import type { CcTask } from "@/lib/command-center/tasks";

interface Props {
  initialTasks: CcTask[];
}

export function TaskPanel({ initialTasks }: Props) {
  const [tasks, setTasks] = useState<CcTask[]>(initialTasks);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const doneCount = tasks.filter((t) => t.done).length;

  function toggle(id: string) {
    const optimistic = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    setTasks(optimistic);
    startTransition(async () => {
      try {
        const res = await fetch("/api/command-center/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "toggle", id }),
        });
        const data = (await res.json()) as { tasks?: CcTask[] };
        if (data.tasks) setTasks(data.tasks);
      } catch {
        // optimistic stays
      }
    });
  }

  function submitAdd() {
    const label = draft.trim();
    if (!label) {
      setAdding(false);
      return;
    }
    setDraft("");
    setAdding(false);
    startTransition(async () => {
      try {
        const res = await fetch("/api/command-center/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "add", label }),
        });
        const data = (await res.json()) as { tasks?: CcTask[] };
        if (data.tasks) setTasks(data.tasks);
      } catch {
        // ignore
      }
    });
  }

  return (
    <div className="rounded-[3px] border border-[#2a302c] bg-[#0b0d0a] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[0.56rem] uppercase tracking-[0.18em] text-[#a8a29a]">Daily Tasks</span>
        <span className="text-[0.56rem] uppercase tracking-[0.14em] text-[#6f6a61]">
          <span className="text-[#e86f3a]">{doneCount}</span>/{tasks.length}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-[6px]">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => toggle(task.id)}
            disabled={isPending}
            className="flex items-center gap-2 text-left text-[0.7rem] text-[#f4f1e8] transition hover:text-[#e86f3a] disabled:opacity-70"
          >
            <span
              className={`inline-flex h-[12px] w-[12px] flex-shrink-0 items-center justify-center rounded-[2px] border ${
                task.done ? "border-[#e86f3a] bg-[#e86f3a]/30" : "border-[#3d4239] bg-[#10120f]"
              }`}
            >
              {task.done ? <span className="text-[8px] leading-none text-[#e86f3a]">✕</span> : null}
            </span>
            <span className={`truncate ${task.done ? "text-[#e86f3a] line-through decoration-[#e86f3a]/60" : ""}`}>
              {task.label}
            </span>
          </button>
        ))}
      </div>

      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitAdd();
          }}
          className="mt-3 flex items-center gap-2"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitAdd}
            placeholder="New task..."
            className="flex-1 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-2 py-1 text-[0.7rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-3 inline-flex items-center gap-1 text-[0.6rem] uppercase tracking-[0.16em] text-[#6f6a61] transition hover:text-[#e86f3a]"
        >
          <Plus size={10} /> add task
        </button>
      )}
    </div>
  );
}
