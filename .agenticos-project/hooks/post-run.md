# Hook: Post-Run

Fires immediately after a run reaches a terminal state — `completed`, `failed`, or `waiting_for_approval`. Its purpose is to persist useful outputs, update the memory index, record the audit trail, and surface the run result to the user in a coherent, actionable form.

This is a deterministic hook: it runs fixed persistence and indexing logic, not model inference.

---

## Trigger Condition

Fires when a run transitions to any terminal state:
- `completed` — all steps finished and final output was generated.
- `failed` — an unrecoverable error occurred during execution.
- `waiting_for_approval` — execution was halted pending user approval.

Does not fire:
- Between steps within a running workflow.
- On intermediate status transitions (`queued` → `planning` → `running`).

---

## Inputs Required

| Input | Source | Required |
|---|---|---|
| Run record (final state) | SQLite runs table | Yes |
| Final output text | `run.finalOutput` | Yes (if `completed`) |
| Run plan | SQLite plans table | Yes |
| Tool call records | SQLite tool_calls table | Yes |
| Vault write path | Skill's `outputLocation` | Yes |
| Memory index connection | Vault indexer | Yes |

---

## Processing Steps

### Step 1 — Validate Final Output
- Confirm `run.finalOutput` is not empty, null, or a generic failure message.
- If `finalOutput` is empty and status is `completed`: log a warning and set status to `failed` with reason `"Final output missing after completion."` This is a bug condition — surface it clearly.
- If status is `failed`: confirm the failure reason is recorded in `run.errors`. If not: add a generic error record.

### Step 2 — Artifact Persistence
If the run status is `completed` and `finalOutput` is present:
1. Determine the save path: `skill.outputLocation ?? "/vault/runs"`.
2. Write the markdown artifact using `writeVaultMarkdown(folder, run.title, run.finalOutput)`.
3. Confirm the file was written: check that the returned path exists.
4. Add the artifact path to `run.filesTouched` and `run.createdArtifacts`.
5. If the write fails: log the error, add to `run.errors`, but do not change run status — the run completed even if the artifact write failed.

### Step 3 — Memory Indexing
If the artifact was successfully written:
1. Call `indexGeneratedArtifact(artifactPath, description, tags)` with:
   - `description`: `"Generated result for [run.title]"`
   - `tags`: `[plan.category, skill?.id ?? "unclassified"]`
2. Confirm the index entry was created.
3. If indexing fails: log the failure but do not surface it as a run error — runs should not fail because of indexing failures.

### Step 4 — Run Record Update
Update the run record with final state:
- `run.status`: `completed` | `failed` | `waiting_for_approval`
- `run.endedAt`: current ISO timestamp.
- `run.durationMs`: `Date.parse(endedAt) - Date.parse(startedAt)`
- `run.filesTouched`: final list.
- `run.createdArtifacts`: final list.
- `run.errors`: any errors accumulated during execution.

Call `updateRun(run, plan)` to persist.

### Step 5 — Audit Log
Write a final audit log entry:
```typescript
{
  actor: "agent",
  action: `${run.status === "completed" ? "completed" : "failed"} workflow`,
  integration: skill?.requiredIntegrations[0] ?? "local",
  riskLevel: skill?.riskLevel ?? "low",
  result: run.status === "completed" ? "completed" : "failed",
}
```

### Step 6 — Approval State Surface (if applicable)
If status is `waiting_for_approval`:
- Confirm all approval request records are visible in the approvals table.
- Confirm `run.approvals` contains the IDs of all pending approval requests.
- Do not proceed with any further output generation — the run is genuinely paused.
- Surface a clear message in the run detail view: how many approvals are pending, what actions they gate, and how to grant them.

---

## Output

Post-run does not produce a user-visible response directly. It produces:
1. A saved vault artifact (if status = `completed`).
2. An updated run record in SQLite.
3. An indexed memory entry (if artifact was saved).
4. An audit log entry.
5. A final run state object returned to the API layer for UI rendering.

---

## Failure Handling

| Failure | Behavior |
|---|---|
| Artifact write fails | Log error in `run.errors`. Run status remains `completed`. UI shows artifact write failure separately. |
| Memory indexing fails | Log warning. Run status unaffected. Surface in run detail as a non-critical warning. |
| `updateRun` fails | Retry once. If second attempt fails: surface critical error — run state may be inconsistent. |
| Audit log write fails | Log to stderr. Do not fail the run. Audit log gaps are tracked separately. |
| `finalOutput` empty on `completed` run | Force status to `failed`. Log as bug. Surface prominently — this should never happen. |

---

## Implementation Notes

- Post-run must be called exactly once per run terminal transition. Calling it twice on the same run should be idempotent — check `run.endedAt` before processing.
- Do not emit partial artifacts. If the vault write is interrupted, the incomplete file should be cleaned up rather than left in a broken state.
- Duration calculation uses `Date.parse()` on ISO strings. Ensure both `startedAt` and `endedAt` are valid ISO-8601 timestamps before computing `durationMs`.
