/**
 * Crash recovery. If the Node process dies mid-workflow, the run row stays
 * pinned at `planning` / `running` forever. On boot we sweep any non-terminal
 * runs older than RUN_STALE_MS and mark them failed so the SSE stream can
 * close out cleanly instead of polling indefinitely.
 */

import { getDb, saveDb } from "@/lib/db/client";
import { nowIso } from "@/lib/utils";

const RUN_STALE_MS = 10 * 60 * 1000; // 10 minutes
const NON_TERMINAL = ["planning", "running", "waiting_for_approval"] as const;

export async function recoverStaleRuns(): Promise<{ recovered: number }> {
  const db = await getDb();
  const cutoff = new Date(Date.now() - RUN_STALE_MS).toISOString();
  const placeholders = NON_TERMINAL.map(() => "?").join(",");
  const result = db.exec(
    `SELECT id FROM runs WHERE status IN (${placeholders}) AND started_at < ?`,
    [...NON_TERMINAL, cutoff],
  );
  const ids = (result[0]?.values ?? []).map((row) => String(row[0]));
  if (!ids.length) return { recovered: 0 };

  const now = nowIso();
  for (const id of ids) {
    db.run(
      `UPDATE runs
         SET status = 'failed',
             ended_at = COALESCE(ended_at, ?),
             errors_json = json_array('Run aborted: server restarted mid-execution'),
             final_output = COALESCE(final_output, '# Recovery\n\nThis run was aborted because the server restarted before it completed.')
       WHERE id = ?`,
      [now, id],
    );
  }
  await saveDb();
  return { recovered: ids.length };
}
