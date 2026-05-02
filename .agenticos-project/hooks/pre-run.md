# Hook: Pre-Run

Fires immediately before a run executes — after the user submits a prompt but before the agent engine processes the first step. Its purpose is to validate that all preconditions are satisfied and to configure the run's execution mode, risk posture, and approval requirements before any tool calls are made.

This is a deterministic hook: it runs fixed validation logic, not model inference. Its output is a run configuration object passed to the agent engine.

---

## Trigger Condition

Fires on every run submission, without exception. Runs that fail pre-run validation are rejected before any execution occurs and before any audit log entries are created for tool calls.

---

## Inputs Required

| Input | Source | Required |
|---|---|---|
| User prompt | Dashboard submission | Yes |
| Selected skill (if any) | Dashboard skill selector | No |
| Selected model profile | Dashboard provider selector | No |
| Dry-run flag | Request body | Yes |
| Session context packet | Session-start hook output | Yes |
| Pending approvals for this skill | SQLite approvals table | Yes |

---

## Validation Steps

Run all checks in order. A failure at any step halts the run and returns a validation error to the UI.

### Check 1 — Prompt Validity
- Prompt must not be empty after trimming whitespace.
- Prompt must be under the configured maximum length (default: 8000 characters).
- Failure response: `"Prompt is required and must be under 8000 characters."`

### Check 2 — Provider Availability
- If a model profile is selected: verify the provider adapter exists in the registry.
- If the provider was marked unavailable at session start: confirm whether it has recovered (for Ollama: re-check `/api/tags`). If still unavailable: set execution mode to `mock` and log the reason.
- If no model profile is selected: set execution mode to `mock` (no model = no generation).

### Check 3 — Skill Risk and Mode Compatibility
If a skill is selected:
- Retrieve the skill's `riskLevel` and `executionMode`.
- If `executionMode` is `approval` and `dryRun` is `false`: create approval gates for all `high` and `critical` steps before the run begins.
- If `riskLevel` is `critical` and `executionMode` is `auto`: override to `approval` and log the override with reason.
- If the skill requires integrations that are not configured: set those steps to `mock` mode and flag them in the run plan.

### Check 4 — Credential Availability
For each integration required by the selected skill:
- Check whether the required environment variable is set.
- If a required credential is missing and the skill's execution mode is not `dry-run`: downgrade affected steps to `mock` mode and log which credential is missing and what capability it enables.
- Never fail the run due to a missing optional credential — mark the integration as unavailable and continue.

### Check 5 — Approval Gate Pre-creation
- For every planned step with `riskLevel: high` or `critical` where `requiresApproval: true`:
  - Create the approval request record before any execution begins.
  - Set the run status to `waiting_for_approval` immediately.
  - Do not proceed with any other steps until the approval is granted.

### Check 6 — Duplicate Run Guard
- Check whether an identical run (same prompt + same skill) is currently `running` or `planning`.
- If a duplicate is detected: surface a warning in the UI. Do not block — allow the user to confirm they want to proceed.

---

## Output: Run Configuration Object

```typescript
{
  runId: string,
  prompt: string,
  skill: Skill | undefined,
  executionMode: "dry-run" | "approval" | "auto" | "mock",
  providerAvailable: boolean,
  modelProfile: SelectedModelProfile | undefined,
  stepConfigs: Array<{
    planStepId: string,
    mode: "execute" | "mock" | "blocked",
    reason?: string,
  }>,
  approvalGates: Array<{
    stepId: string,
    action: string,
    riskLevel: RiskLevel,
  }>,
  warnings: string[],
}
```

---

## Failure Response Format

When a validation check fails, return a structured error — not a raw exception:

```json
{
  "error": "pre-run-validation",
  "check": "[Check name that failed]",
  "message": "[Human-readable explanation of what failed and what the user must do]",
  "runId": null
}
```

---

## Logging Requirements

Pre-run must log the following to the audit trail regardless of outcome:
- Timestamp of validation.
- Selected skill and provider.
- Execution mode determined.
- Any validation failures (with reasons).
- Any approval gates created (with step IDs).
- Any credentials found to be missing (variable name only — never the value).

---

## Implementation Notes

- Pre-run validation is synchronous and must complete before the first `insertRunStep` call.
- If pre-run creates approval gates, the run engine must check for pending approvals before executing each step — not just at run start.
- A run that passes pre-run validation but fails mid-execution (e.g., model call timeout) is a runtime failure, not a pre-run failure. Handle it separately in the run engine's error path.
