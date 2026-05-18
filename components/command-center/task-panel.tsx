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
    <div className="cc-panel cc-panel-muted min-h-[154px] overflow-hidden p-[16px_18px]">
      <div className="relative z-[1] mb-3 flex items-center justify-between gap-3">
        <span className="text-[0.82rem] uppercase tracking-[0.12em] text-[#a8a29a]">Daily Tasks</span>
        <span className="text-[0.84rem] uppercase tracking-[0.1em] text-[#8d877e]">
          <span className="text-[#e86f3a]">{doneCount}</span>/{tasks.length}
        </span>
      </div>

      <div className="relative z-[1] grid grid-cols-1 gap-x-6 gap-y-[10px] sm:grid-cols-2">
        {tasks.map((task) => (
          <button
            key={task.id}
            type="button"
            onClick={() => toggle(task.id)}
            disabled={isPending}
            className="flex items-center gap-3 text-left text-[0.98rem] text-[#f4f1e8] transition hover:text-[#e86f3a] disabled:opacity-70"
          >
            <span
              className={`inline-flex h-[15px] w-[15px] flex-shrink-0 items-center justify-center rounded-[2px] border ${
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
          className="relative z-[1] mt-3 flex items-center gap-2"
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={submitAdd}
            placeholder="New task..."
            className="flex-1 rounded-[2px] border border-[#2a302c] bg-[#10120f] px-3 py-2 text-[0.9rem] text-[#f4f1e8] outline-none focus:border-[#e86f3a]"
          />
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="relative z-[1] mt-4 inline-flex items-center gap-2 text-[0.76rem] uppercase tracking-[0.14em] text-[#8d877e] transition hover:text-[#e86f3a]"
        >
          <Plus size={10} /> add task
        </button>
      )}
    </div>
  );
}
