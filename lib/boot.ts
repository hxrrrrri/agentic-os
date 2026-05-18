/**
 * Deferred startup. Layout used to call `startScheduler()` and
 * `indexVaultGraph()` at module-load time — that ran on every server cold
 * boot, including for pages that don't need either (e.g. `/login`). API
 * handlers now call `ensureBoot()` (fire-and-forget) on first invocation;
 * each subsystem is idempotent so repeat calls are cheap.
 */

import { startScheduler } from "@/lib/scheduler/worker";
import { indexVaultGraph } from "@/lib/vault/graph";
import { recoverAll } from "@/lib/agent/recovery";

let booted = false;

export function ensureBoot(): void {
  if (booted) return;
  booted = true;
  // None of these block the caller — failures are swallowed so a single
  // misconfigured subsystem can't break unrelated requests. `recoverAll`
  // covers stale runs + expired approvals in one pass.
  void startScheduler().catch(() => {});
  void indexVaultGraph().catch(() => {});
  void recoverAll().catch(() => {});
}
