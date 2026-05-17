import fs from "node:fs/promises";
import path from "node:path";
import { ensureVault, resolveVaultPath } from "@/lib/vault/service";
import { slugify } from "@/lib/utils";

const TASK_FILE = "ops/tasks.md";

export interface CcTask {
  id: string;
  label: string;
  done: boolean;
  carryover: boolean;
}

const seedTasks: CcTask[] = [
  { id: slugify("Skool-post"), label: "Skool-post", done: true, carryover: false },
  { id: slugify("YouTube recording"), label: "YouTube recording", done: false, carryover: false },
  { id: slugify("Inbox triage"), label: "Inbox triage", done: false, carryover: false },
  { id: slugify("Daily review"), label: "Daily review", done: false, carryover: false },
  { id: slugify("Skool consolidation pass (carryover from 05-13)"), label: "Skool consolidation pass (carryover from 05-13)", done: false, carryover: true },
  { id: slugify("Prep live-stream rundown + thumbnail"), label: "Prep live-stream rundown + thumbnail", done: false, carryover: false },
];

function renderTasks(tasks: CcTask[]): string {
  const lines = ["# Daily Tasks", ""];
  tasks.forEach((t) => lines.push(`- [${t.done ? "x" : " "}] ${t.label}`));
  return lines.join("\n") + "\n";
}

function parseTasks(md: string): CcTask[] {
  return md
    .split(/\r?\n/)
    .filter((l) => /^- \[[ x]\]/i.test(l))
    .map((line) => {
      const done = /^- \[x\]/i.test(line);
      const label = line.replace(/^- \[[ x]\]\s*/i, "").trim();
      return {
        id: slugify(label) || `t-${Math.random().toString(36).slice(2, 8)}`,
        label,
        done,
        carryover: /carryover/i.test(label),
      };
    });
}

async function filePath() {
  await ensureVault();
  const target = resolveVaultPath(TASK_FILE);
  await fs.mkdir(path.dirname(target), { recursive: true });
  return target;
}

async function ensureFile(): Promise<string> {
  const target = await filePath();
  try {
    await fs.access(target);
  } catch {
    await fs.writeFile(target, renderTasks(seedTasks), "utf8");
  }
  return target;
}

export async function readTasks(): Promise<CcTask[]> {
  const target = await ensureFile();
  const content = await fs.readFile(target, "utf8");
  const parsed = parseTasks(content);
  return parsed.length ? parsed : seedTasks;
}

export async function toggleTask(id: string): Promise<CcTask[]> {
  const tasks = await readTasks();
  const next = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
  const target = await filePath();
  await fs.writeFile(target, renderTasks(next), "utf8");
  return next;
}

export async function addTask(label: string): Promise<CcTask[]> {
  const trimmed = label.trim();
  if (!trimmed) return readTasks();
  const tasks = await readTasks();
  const id = slugify(trimmed);
  if (tasks.find((t) => t.id === id)) return tasks;
  const next: CcTask[] = [...tasks, { id, label: trimmed, done: false, carryover: false }];
  const target = await filePath();
  await fs.writeFile(target, renderTasks(next), "utf8");
  return next;
}
