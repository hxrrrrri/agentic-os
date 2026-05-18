/**
 * Agent inbox — unified queue for Gmail / Slack / generic incoming messages
 * that need a drafted reply. The agent drafts; the user reviews/edits/sends.
 *
 * Drafting is gated by skill execution mode; the actual send is always behind
 * an approval row. This keeps "auto-reply" safe by default.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";

export type InboxSource = "gmail" | "slack" | "discord" | "webhook" | "manual";
export type InboxStatus = "new" | "drafting" | "draft_ready" | "approved" | "sent" | "archived" | "snoozed" | "failed";

export interface InboxItem {
  id: string;
  source: InboxSource;
  sender?: string;
  subject?: string;
  body: string;
  status: InboxStatus;
  draftReply?: string;
  runId?: string;
  receivedAt: string;
  handledAt?: string;
  metadata?: Record<string, unknown>;
}

interface InboxRow {
  id: string;
  source: string;
  sender: string | null;
  subject: string | null;
  body: string;
  status: string;
  draft_reply: string | null;
  run_id: string | null;
  received_at: string;
  handled_at: string | null;
  metadata_json: string | null;
}

function rowToItem(r: InboxRow): InboxItem {
  return {
    id: r.id,
    source: r.source as InboxSource,
    sender: r.sender ?? undefined,
    subject: r.subject ?? undefined,
    body: r.body,
    status: r.status as InboxStatus,
    draftReply: r.draft_reply ?? undefined,
    runId: r.run_id ?? undefined,
    receivedAt: r.received_at,
    handledAt: r.handled_at ?? undefined,
    metadata: r.metadata_json ? (JSON.parse(r.metadata_json) as Record<string, unknown>) : undefined,
  };
}

export async function ingestInboxItem(input: Omit<InboxItem, "id" | "status" | "receivedAt"> & { status?: InboxStatus; receivedAt?: string }): Promise<InboxItem> {
  const db = await getDb();
  const id = createId("inb");
  const status = input.status ?? "new";
  const receivedAt = input.receivedAt ?? nowIso();
  db.run(
    `INSERT INTO inbox_items (id, source, sender, subject, body, status, draft_reply, run_id, received_at, metadata_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.source,
      input.sender ?? null,
      input.subject ?? null,
      input.body,
      status,
      input.draftReply ?? null,
      input.runId ?? null,
      receivedAt,
      input.metadata ? JSON.stringify(input.metadata) : null,
    ],
  );
  await saveDb();
  return {
    id,
    source: input.source,
    sender: input.sender,
    subject: input.subject,
    body: input.body,
    status,
    draftReply: input.draftReply,
    runId: input.runId,
    receivedAt,
    metadata: input.metadata,
  };
}

export async function listInbox(limit = 100, status?: InboxStatus): Promise<InboxItem[]> {
  const db = await getDb();
  const where = status ? `WHERE status = '${status.replace(/'/g, "''")}'` : "";
  const result = db.exec(
    `SELECT id, source, sender, subject, body, status, draft_reply, run_id, received_at, handled_at, metadata_json
     FROM inbox_items ${where} ORDER BY received_at DESC LIMIT ${Number(limit) || 100}`,
  );
  return rows<InboxRow>(result).map(rowToItem);
}

export async function getInboxItem(id: string): Promise<InboxItem | null> {
  const db = await getDb();
  const result = db.exec(
    `SELECT id, source, sender, subject, body, status, draft_reply, run_id, received_at, handled_at, metadata_json
     FROM inbox_items WHERE id = ?`,
    [id],
  );
  const row = rows<InboxRow>(result)[0];
  return row ? rowToItem(row) : null;
}

export async function updateInboxItem(id: string, updates: Partial<Pick<InboxItem, "status" | "draftReply" | "runId">>): Promise<void> {
  const db = await getDb();
  const fields: string[] = [];
  const values: Array<string | number | null> = [];
  if (updates.status !== undefined) {
    fields.push("status = ?");
    values.push(updates.status);
    if (["sent", "archived", "failed"].includes(updates.status)) {
      fields.push("handled_at = ?");
      values.push(nowIso());
    }
  }
  if (updates.draftReply !== undefined) {
    fields.push("draft_reply = ?");
    values.push(updates.draftReply);
  }
  if (updates.runId !== undefined) {
    fields.push("run_id = ?");
    values.push(updates.runId);
  }
  if (!fields.length) return;
  values.push(id);
  db.run(`UPDATE inbox_items SET ${fields.join(", ")} WHERE id = ?`, values);
  await saveDb();
}

export async function inboxStats(): Promise<{ total: number; new: number; drafted: number; sent: number }> {
  const db = await getDb();
  const result = db.exec(
    `SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
      SUM(CASE WHEN status = 'draft_ready' THEN 1 ELSE 0 END) AS drafted,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent
     FROM inbox_items`,
  );
  const r = result[0]?.values[0];
  return {
    total: Number(r?.[0] ?? 0),
    new: Number(r?.[1] ?? 0),
    drafted: Number(r?.[2] ?? 0),
    sent: Number(r?.[3] ?? 0),
  };
}
