# Hook: Session Start

Fires once at the beginning of a new AgenticOS session, before the first model call. Its purpose is to assemble a complete operational context packet — provider state, project context, memory snapshot, and permission defaults — so that the first run does not start cold.

This is a deterministic hook: it runs fixed logic, not model inference. The output is a structured context packet passed to the model system prompt.

---

## Trigger Condition

Fires when:
- A new session is initialized (application load or session reset).
- The user switches to a different project workspace.
- More than 4 hours have elapsed since the last session (stale session refresh).

Does not fire:
- Between runs within the same session.
- On every prompt submission.

---

## Inputs Required

| Input | Source | Required |
|---|---|---|
| Active provider profile | User settings / `agenticos.config.ts` | Yes |
| Selected model | User settings | Yes |
| Project context manifest | `.agenticos-project/` folder | Yes |
| Recent run history | SQLite run table, last 10 runs | Yes |
| Memory index snapshot | Vault memory index, last 25 items | Yes |
| Pending approvals | SQLite approvals table | Yes |
| Environment variable status | `process.env` availability check | Yes |

---

## Processing Steps

### Step 1 — Provider Health Check
- Verify the selected provider is reachable.
- For Ollama: `GET http://127.0.0.1:11434/api/tags` — confirm response and list available models.
- For cloud providers: verify the required API key environment variable is set (do not validate by making a live call at session start).
- If provider is unreachable: log the failure, set execution mode to `mock`, and surface a warning in the session context.

### Step 2 — Project Context Assembly
Load and concatenate the following files from `.agenticos-project/`:
1. `project.md` — always included.
2. `rules/safety.md` — always included.
3. `rules/artifacts.md` — always included.
4. `rules/provider-agnostic.md` — always included.
5. Active provider config (e.g., `providers/ollama.md`) — included based on selected provider.

Truncate to fit within the model's context window after the system prompt and user prompt are accounted for. Priority order for truncation: provider config first, then artifact rules, then provider-agnostic rules. Never truncate `project.md` or `rules/safety.md`.

### Step 3 — Memory Snapshot
- Retrieve the 25 most recently indexed memory items from the vault index.
- Format as a compact list: `[title] — [one-line summary] — [vault path]`.
- This snapshot tells the model what knowledge is available without injecting the full content of every memory file.

### Step 4 — Session State Summary
Produce a compact session state block:

```
Session initialized: [ISO timestamp]
Provider: [provider id] — [status: available | unavailable | mock]
Model: [model name]
Pending approvals: [count] ([ids if >0])
Recent runs: [count] — last: [title] ([status])
Memory items indexed: [count]
Execution mode: [dry-run | approval | auto | mock]
```

### Step 5 — Output
Emit the assembled context packet to the system prompt injection layer. Do not surface the full packet to the user — surface only the session state summary as a status indicator in the UI.

---

## Expected Output

A structured context packet containing:
- Concatenated project context (project.md + rules).
- Active provider configuration block.
- Memory snapshot (compact list).
- Session state summary block.
- Execution mode determination.

---

## Failure Handling

| Failure | Behavior |
|---|---|
| Provider unreachable | Set mode to `mock`, surface warning in UI, continue session |
| `.agenticos-project/` missing | Use default system prompt only, log warning, do not block session |
| Memory index empty | Continue with `memoryCount: 0`, no error |
| Required env var missing | Log which variable is missing, set affected integrations to `unavailable` |
| SQLite unavailable | Surface error prominently, block run execution until resolved |

---

## Implementation Notes

- This hook is idempotent: running it twice in the same session produces the same result.
- The context packet is cached for the session duration. Re-assembly is triggered by workspace switch or stale session refresh.
- Never include API keys, tokens, or secrets in the context packet. Reference their availability status only.
