# Provider-Agnostic Execution Rules

AgenticOS must not depend on any single model vendor's private behavior, proprietary prompt format, or undocumented capability. Every skill, agent, command, and output style must produce correct, useful results across Ollama, NVIDIA, OpenAI-compatible APIs, Anthropic, Gemini, Grok, and any future adapter.

---

## What Every Provider Receives

Every model call — regardless of provider — must include the following context:

| Context Piece | Source | Required |
|---|---|---|
| User prompt | Dashboard input | Always |
| System prompt with response standards | `lib/agent/llm.ts` | Always |
| Selected skill name, category, and output location | Active skill | When skill is selected |
| Memory item count | Local vault index | Always |
| Project context (relevant sections of this folder) | `.agenticos-project/` | Always |
| Safety rules | `rules/safety.md` | Always |
| Output style | Selected style or skill default | When specified |

---

## Provider-Specific Behavior Guidelines

### Local Models (Ollama)
- Use explicit, highly structured prompts. Local models benefit from more scaffolding.
- Break complex tasks into numbered steps within the prompt — do not rely on the model inferring structure.
- Use shorter max-token targets per section. Local models drift on very long outputs.
- If the model returns an empty or malformed response, fall back to the `summarize()` function and log the failure clearly.
- Never assume a locally-named model (e.g., `llama3`) is available. Verify via `/api/tags` before selection.

### Cloud Models (NVIDIA, OpenAI-compatible)
- These models are stronger but the same approval gates and local-first assumptions apply without exception.
- Use temperature ≤ 0.5 for research and planning tasks. Use 0.7–0.9 for creative content.
- Respect `max_tokens` limits appropriate to the task — do not let cloud models pad indefinitely.
- Never log the API key in any output, error message, run artifact, or audit trail.
- If the endpoint returns a non-200 status, report the exact HTTP status and error body in the run output.

### Future Providers
- All new adapters must implement the `generateWithModel` interface defined in `lib/agent/llm.ts`.
- A new provider that cannot meet the interface contract should not be silently skipped — it should surface a clear error.
- Vendor-specific features (streaming, tool-use APIs, function calling) are opt-in enhancements. Core generation must work without them.

---

## Execution Modes

| Mode | Description | Triggers |
|---|---|---|
| `dry-run` | Plan is produced, tool calls are logged, no external mutations | Default when credentials are absent |
| `approval` | Risky steps are staged and blocked until the user approves | Skill risk level is `high` or `critical` |
| `auto` | All steps execute without per-step confirmation | Skill explicitly set to auto + low risk |
| `mock` | Entire run is simulated, output is labeled as mock | No provider configured or adapter missing |

**Transition rules:**
- `dry-run` → `auto` requires explicit user action (selecting a model and confirming execution mode).
- `mock` output must be visually distinct from real output. Label it `[SIMULATED]` in the artifact header.
- Never silently downgrade from `auto` to `mock` without logging a clear reason.

---

## Honest Failure Contract

When something goes wrong, the response must:

1. State exactly what failed: provider name, error type, HTTP status, or error message.
2. State what was produced despite the failure (mock output, partial output, or nothing).
3. State what the user must do to unblock execution (configure credentials, restart Ollama, select a different model).
4. Not pretend the intended action completed successfully.

**Bad failure response:**
> "The workflow completed. Your inbox has been triaged."

**Good failure response:**
> "Model call failed: Ollama returned 404 (model `llama3` not found locally). Output below is a structured mock summary — no real inbox was accessed. To run with a real model: pull the model with `ollama pull llama3` and retry."

---

## No Vendor Lock Checklist

Before adding any provider-specific feature, verify:

- [ ] The feature degrades gracefully when that provider is unavailable.
- [ ] Skills and agents do not reference provider-specific syntax or model names in their playbooks.
- [ ] Output produced by one provider can be understood and acted upon if a different provider generated it in a future run.
- [ ] Approval gates are enforced identically regardless of which provider is active.
