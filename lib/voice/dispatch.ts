/**
 * Voice-to-action — transcribe audio, classify intent, dispatch to the right
 * skill/run. Stores every transcript in `voice_intents` for replay/audit.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { classifyPrompt, getSkill } from "@/lib/skills/registry";
import { startRun } from "@/lib/agent/engine";
import { createId, nowIso } from "@/lib/utils";

export interface VoiceIntent {
  id: string;
  transcript: string;
  intent?: string;
  skillId?: string;
  runId?: string;
  createdAt: string;
}

interface IntentRow { id: string; transcript: string; intent: string | null; skill_id: string | null; run_id: string | null; created_at: string }

const INTENT_KEYWORDS: Array<{ test: RegExp; skillId: string; intent: string }> = [
  { test: /\b(daily|today.*plan|brief|agenda)\b/i,         skillId: "morning-brief",   intent: "daily_brief" },
  { test: /\b(research|deep dive|investigate|look into)\b/i, skillId: "deep-research",   intent: "research" },
  { test: /\b(inbox|email|gmail|triage)\b/i,                skillId: "inbox-triage",    intent: "inbox" },
  { test: /\b(meeting|prep|brief for)\b/i,                  skillId: "meeting-prep",    intent: "meeting_prep" },
  { test: /\b(daily note|journal|log today)\b/i,            skillId: "daily-note",      intent: "journal" },
  { test: /\b(weekly review|recap|week.*summary)\b/i,       skillId: "weekly-review",   intent: "weekly_review" },
];

export function classifyIntent(transcript: string): { intent: string; skillId?: string } {
  for (const rule of INTENT_KEYWORDS) {
    if (rule.test.test(transcript)) {
      const skill = getSkill(rule.skillId);
      return { intent: rule.intent, skillId: skill?.id ?? rule.skillId };
    }
  }
  return { intent: classifyPrompt(transcript) };
}

export async function dispatchVoice(transcript: string, options: { dryRun?: boolean } = {}): Promise<VoiceIntent> {
  const { intent, skillId } = classifyIntent(transcript);
  const run = await startRun({ prompt: transcript, skillId, dryRun: options.dryRun ?? true });
  const db = await getDb();
  const id = createId("voi");
  const now = nowIso();
  db.run(
    `INSERT INTO voice_intents (id, transcript, intent, skill_id, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [id, transcript, intent, skillId ?? null, run.id, now],
  );
  await saveDb();
  return { id, transcript, intent, skillId, runId: run.id, createdAt: now };
}

export async function listVoiceIntents(limit = 50): Promise<VoiceIntent[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, transcript, intent, skill_id, run_id, created_at FROM voice_intents ORDER BY created_at DESC LIMIT ${Number(limit) || 50}`);
  return rows<IntentRow>(result).map((r) => ({
    id: r.id,
    transcript: r.transcript,
    intent: r.intent ?? undefined,
    skillId: r.skill_id ?? undefined,
    runId: r.run_id ?? undefined,
    createdAt: r.created_at,
  }));
}
