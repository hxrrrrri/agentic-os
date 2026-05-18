/**
 * Workspaces (multi-tenant). Each workspace is a soft tenant boundary with
 * its own member list + roles. v1 keeps existing tables tenant-agnostic; the
 * active workspace id is sent through a header (`x-agenticos-workspace`) and
 * stamped onto new audit logs / approvals when present. Strict row-level
 * filtering can be layered on later once a user identity model exists.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso, slugify } from "@/lib/utils";

export type WorkspaceRole = "owner" | "admin" | "operator" | "viewer";

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  members?: WorkspaceMember[];
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userEmail: string;
  role: WorkspaceRole;
  createdAt: string;
}

interface WsRow { id: string; name: string; slug: string; created_at: string }
interface MemberRow { id: string; workspace_id: string; user_email: string; role: string; created_at: string }

export async function listWorkspaces(): Promise<Workspace[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, name, slug, created_at FROM workspaces ORDER BY created_at ASC`);
  const items = rows<WsRow>(result).map((r) => ({ id: r.id, name: r.name, slug: r.slug, createdAt: r.created_at }));

  const memberResult = db.exec(`SELECT id, workspace_id, user_email, role, created_at FROM workspace_members`);
  const members = rows<MemberRow>(memberResult);
  return items.map((ws) => ({
    ...ws,
    members: members
      .filter((m) => m.workspace_id === ws.id)
      .map((m) => ({ id: m.id, workspaceId: m.workspace_id, userEmail: m.user_email, role: m.role as WorkspaceRole, createdAt: m.created_at })),
  }));
}

export async function createWorkspace(name: string): Promise<Workspace> {
  const db = await getDb();
  const id = createId("ws");
  const slug = `${slugify(name)}-${id.slice(-4)}`;
  const now = nowIso();
  db.run(`INSERT INTO workspaces (id, name, slug, created_at) VALUES (?, ?, ?, ?)`, [id, name, slug, now]);
  await saveDb();
  return { id, name, slug, createdAt: now, members: [] };
}

export async function addMember(workspaceId: string, email: string, role: WorkspaceRole): Promise<WorkspaceMember> {
  const db = await getDb();
  const id = createId("wsm");
  const now = nowIso();
  db.run(
    `INSERT INTO workspace_members (id, workspace_id, user_email, role, created_at) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(workspace_id, user_email) DO UPDATE SET role = excluded.role`,
    [id, workspaceId, email, role, now],
  );
  await saveDb();
  return { id, workspaceId, userEmail: email, role, createdAt: now };
}

export async function removeMember(workspaceId: string, email: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM workspace_members WHERE workspace_id = ? AND user_email = ?`, [workspaceId, email]);
  await saveDb();
}

export async function deleteWorkspace(id: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM workspace_members WHERE workspace_id = ?`, [id]);
  db.run(`DELETE FROM workspaces WHERE id = ?`, [id]);
  await saveDb();
}

/** Hierarchy: owner > admin > operator > viewer. Returns true if role meets minimum. */
export function roleHasLeast(role: WorkspaceRole, minimum: WorkspaceRole): boolean {
  const order: WorkspaceRole[] = ["viewer", "operator", "admin", "owner"];
  return order.indexOf(role) >= order.indexOf(minimum);
}
