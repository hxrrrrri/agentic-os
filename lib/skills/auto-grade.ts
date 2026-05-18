/**
 * Auto-grader + skill distiller.
 *
 * After each successful run, a job is enqueued (`run.grade`) that scores the
 * output against a 5-dimension rubric. High-scoring runs accumulate; once a
 * skill has N graded runs averaging >= adopt threshold, a distillation job
 * fires to write a refined skill prompt patch into the vault for review.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";
import { getRun } from "@/lib/db/repositories";
import { generateWithModel } from "@/lib/agent/llm";
import { listModelProviders } from "@/lib/agent/providers";
import { writeVaultMarkdown } from "@/lib/vault/service";
import { getSkill } from "@/lib/skills/registry";

interface GradeRow { id: string; run_id: string; skill_id: string | null; score: number; rubric_json: string | null; notes: string | null; created_at: string }
interface PatchRow { id: string; skill_id: string; version: number; patch_prompt: string; based_on_run_ids: string | null; created_at: string; adopted: number }

const RUBRIC_DIMENSIONS = ["clarity", "specificity", "actionability", "format", "tone"] as const;

export interface GradeRubric { [k: string]: number }
export interface Grade { id: string; runId: string; skillId?: string; score: number; rubric: GradeRubric; notes?: string; createdAt: string }

function bestAvailableProvider() {
  return listModelProviders().find((p) => !p.requiresApiKey || process.env[`${p.id.replace(/-/g, "").toUpperCase()}_API_KEY`])
    ?? listModelProviders()[0];
}

function parseGradeText(raw: string): { rubric: GradeRubric; score: number; notes: string } {
  const rubric: GradeRubric = {};
  for (const dim of RUBRIC_DIMENSIONS) {
    const m = new RegExp(`${dim}\\s*[:=]\\s*(\\d+(?:\\.\\d+)?)`, "i").exec(raw);
    if (m) rubric[dim] = Math.min(10, Math.max(0, Number(m[1])));
  }
  const values = Object.values(rubric);
  const score = values.length ? values.reduce((a, b) => a + b, 0) / values.length / 10 : 0.5;
  return { rubric, score, notes: raw.slice(0, 2000) };
}

export async function gradeRun(runId: string): Promise<Grade | null> {
  const run = await getRun(runId);
  if (!run || !run.finalOutput) return null;
  const skill = run.selectedSkill ? getSkill(run.selectedSkill) : undefined;

  const provider = bestAvailableProvider();
  if (!provider) return null;

  const gradePrompt = [
    "You are a strict QA reviewer.",
    "Score the following AI-generated output on five dimensions, 0-10 each:",
    `Dimensions: ${RUBRIC_DIMENSIONS.join(", ")}.`,
    "Output exactly the format below, one per line:",
    "clarity: 7",
    "specificity: 8",
    "actionability: 6",
    "format: 9",
    "tone: 7",
    "notes: <one sentence on the biggest improvement>",
    "",
    `Task that produced the output: ${run.prompt.slice(0, 800)}`,
    "",
    "Output to grade:",
    run.finalOutput.slice(0, 6000),
  ].join("\n");

  let raw = "";
  try {
    const result = await generateWithModel({
      provider,
      model: provider.model,
      prompt: gradePrompt,
      memoryCount: 0,
    });
    raw = result.content;
  } catch {
    return null;
  }

  const { rubric, score, notes } = parseGradeText(raw);
  const id = createId("grade");
  const db = await getDb();
  db.run(
    `INSERT INTO run_grades (id, run_id, skill_id, score, rubric_json, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, runId, run.selectedSkill ?? null, score, JSON.stringify(rubric), notes, nowIso()],
  );
  await saveDb();

  // If this skill now has 5+ grades, consider distilling.
  if (skill) {
    const recent = await listGradesForSkill(skill.id, 10);
    if (recent.length >= 5) {
      const avg = recent.reduce((a, g) => a + g.score, 0) / recent.length;
      if (avg >= 0.75) {
        await maybeDistillPatch(skill.id, recent).catch(() => {});
      }
    }
  }

  return { id, runId, skillId: run.selectedSkill, score, rubric, notes, createdAt: nowIso() };
}

export async function listGradesForSkill(skillId: string, limit = 20): Promise<Grade[]> {
  const db = await getDb();
  const result = db.exec(
    `SELECT id, run_id, skill_id, score, rubric_json, notes, created_at FROM run_grades WHERE skill_id = ? ORDER BY created_at DESC LIMIT ${Number(limit) || 20}`,
    [skillId],
  );
  return rows<GradeRow>(result).map((r) => ({
    id: r.id,
    runId: r.run_id,
    skillId: r.skill_id ?? undefined,
    score: r.score,
    rubric: r.rubric_json ? JSON.parse(r.rubric_json) : {},
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }));
}

export async function listAllGrades(limit = 50): Promise<Grade[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, run_id, skill_id, score, rubric_json, notes, created_at FROM run_grades ORDER BY created_at DESC LIMIT ${Number(limit) || 50}`);
  return rows<GradeRow>(result).map((r) => ({
    id: r.id,
    runId: r.run_id,
    skillId: r.skill_id ?? undefined,
    score: r.score,
    rubric: r.rubric_json ? JSON.parse(r.rubric_json) : {},
    notes: r.notes ?? undefined,
    createdAt: r.created_at,
  }));
}

async function maybeDistillPatch(skillId: string, grades: Grade[]): Promise<void> {
  const db = await getDb();
  const existing = db.exec(`SELECT MAX(version) FROM skill_patches WHERE skill_id = ?`, [skillId]);
  const nextVersion = Number(existing[0]?.values[0]?.[0] ?? 0) + 1;

  // If we already have a recent patch (last 24h), skip.
  const recent = db.exec(`SELECT created_at FROM skill_patches WHERE skill_id = ? ORDER BY created_at DESC LIMIT 1`, [skillId]);
  const lastTs = recent[0]?.values[0]?.[0] as string | undefined;
  if (lastTs && Date.now() - +new Date(lastTs) < 24 * 3600 * 1000) return;

  const runIds: string[] = [];
  const summaries: string[] = [];
  for (const g of grades.slice(0, 5)) {
    const r = await getRun(g.runId);
    if (!r?.finalOutput) continue;
    runIds.push(r.id);
    summaries.push(`### Run ${r.id} — score ${(g.score * 10).toFixed(1)}/10\nPrompt: ${r.prompt.slice(0, 240)}\nOutput head: ${r.finalOutput.slice(0, 400)}`);
  }
  if (summaries.length < 3) return;

  const provider = bestAvailableProvider();
  if (!provider) return;

  const distillPrompt = [
    "You are a skill prompt engineer.",
    `Skill id: ${skillId}.`,
    "Below are 3-5 high-graded runs of this skill. Distill the patterns that made them succeed into a refined system prompt patch.",
    "Output ONLY the patched skill prompt — concise, instructive, ready to drop into a skill template.",
    "",
    ...summaries,
  ].join("\n\n");

  let patch = "";
  try {
    const result = await generateWithModel({ provider, model: provider.model, prompt: distillPrompt, memoryCount: 0 });
    patch = result.content.trim();
  } catch {
    return;
  }
  if (!patch) return;

  const id = createId("patch");
  db.run(
    `INSERT INTO skill_patches (id, skill_id, version, patch_prompt, based_on_run_ids, created_at, adopted) VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [id, skillId, nextVersion, patch, JSON.stringify(runIds), nowIso()],
  );
  await saveDb();

  // Save to vault for review.
  await writeVaultMarkdown(`skill-patches/${skillId}`, `v${nextVersion}`, patch, {
    frontmatter: { tags: ["skill-patch", skillId], category: "memory", basedOn: runIds, version: nextVersion },
  });
}

export async function listSkillPatches(skillId?: string): Promise<Array<{ id: string; skillId: string; version: number; patchPrompt: string; basedOnRunIds: string[]; createdAt: string; adopted: boolean }>> {
  const db = await getDb();
  const where = skillId ? `WHERE skill_id = ?` : "";
  const result = skillId
    ? db.exec(`SELECT id, skill_id, version, patch_prompt, based_on_run_ids, created_at, adopted FROM skill_patches ${where} ORDER BY created_at DESC LIMIT 50`, [skillId])
    : db.exec(`SELECT id, skill_id, version, patch_prompt, based_on_run_ids, created_at, adopted FROM skill_patches ORDER BY created_at DESC LIMIT 50`);
  return rows<PatchRow>(result).map((r) => ({
    id: r.id,
    skillId: r.skill_id,
    version: r.version,
    patchPrompt: r.patch_prompt,
    basedOnRunIds: r.based_on_run_ids ? JSON.parse(r.based_on_run_ids) : [],
    createdAt: r.created_at,
    adopted: Boolean(r.adopted),
  }));
}

export async function adoptPatch(patchId: string): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE skill_patches SET adopted = 1 WHERE id = ?`, [patchId]);
  await saveDb();
}
