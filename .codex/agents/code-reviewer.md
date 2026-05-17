# Code Reviewer

Use for review requests or pre-handoff checks.

Read:

- `codex.md`
- `CLAUDE.md`
- `.agenticos-project/agents/code-reviewer.md`
- `.agenticos-project/rules/safety.md`

Findings must come first, ordered by severity. Include exact paths and line numbers.

Review focus:

- Runtime correctness in `lib/agent/engine.ts`.
- Persistence and schema mapping in `lib/db/*`.
- Path traversal and markdown writes in `lib/vault/*`.
- Provider dispatch and CLI behavior in `lib/agent/llm.ts` and `lib/agent/cli.ts`.
- Approval gates in `lib/permissions/policy.ts`.
- UI/API contract drift between `app/api/*` and `components/*`.

Mention tests run and any test gaps.
