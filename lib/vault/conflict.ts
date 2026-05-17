import { getDb } from "@/lib/db/client";

export type ConflictType = "duplicate-title" | "broken-link" | "dead-reference";

export interface ConflictResult {
  type: ConflictType;
  severity: "high" | "medium" | "low";
  noteA: string;
  noteB?: string;
  detail: string;
}

function stmtRows<T extends object>(
  db: import("sql.js").Database,
  sql: string,
  params: (string | number | null)[] = [],
): T[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const out: T[] = [];
  while (stmt.step()) out.push(stmt.getAsObject() as T);
  stmt.free();
  return out;
}

export async function detectConflicts(): Promise<ConflictResult[]> {
  const db = await getDb();
  const results: ConflictResult[] = [];

  // 1. Duplicate titles — different paths, identical (case-insensitive) title
  const dupes = stmtRows<{ title: string; paths: string }>(
    db,
    `SELECT title, GROUP_CONCAT(path, '||') AS paths
     FROM vault_nodes WHERE file_exists = 1
     GROUP BY LOWER(title) HAVING COUNT(*) > 1
     ORDER BY title LIMIT 30`,
  );
  for (const row of dupes) {
    const [a, b, ...rest] = row.paths.split("||");
    if (!a || !b) continue;
    const extra = rest.length ? ` (+${rest.length} more)` : "";
    results.push({
      type: "duplicate-title",
      severity: "high",
      noteA: a,
      noteB: b,
      detail: `Same title "${row.title}" exists in multiple notes${extra}. Likely diverged copies.`,
    });
  }

  // 2. Broken wikilinks — target has no matching vault_node title or path stem
  const broken = stmtRows<{ source: string; target: string }>(
    db,
    `SELECT DISTINCT vl.source, vl.target
     FROM vault_links vl
     WHERE vl.resolved_path IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM vault_nodes vn
         WHERE vn.file_exists = 1
           AND (
             LOWER(vn.title) = LOWER(vl.target)
             OR LOWER(REPLACE(REPLACE(vn.path,'raw/',''),'wiki/','')) LIKE LOWER('%' || vl.target || '%')
           )
       )
     LIMIT 40`,
  );
  for (const row of broken) {
    results.push({
      type: "broken-link",
      severity: "medium",
      noteA: row.source,
      detail: `[[${row.target}]] — no matching file found. Note may be missing or misspelled.`,
    });
  }

  // 3. Dead references — links to files marked as no longer existing
  const dead = stmtRows<{ source: string; target: string; path: string }>(
    db,
    `SELECT vl.source, vl.target, vn.path
     FROM vault_links vl
     JOIN vault_nodes vn ON LOWER(vn.title) = LOWER(vl.target)
     WHERE vn.file_exists = 0
     LIMIT 20`,
  );
  for (const row of dead) {
    results.push({
      type: "dead-reference",
      severity: "low",
      noteA: row.source,
      noteB: row.path,
      detail: `[[${row.target}]] references a deleted or moved file (${row.path}).`,
    });
  }

  return results;
}
