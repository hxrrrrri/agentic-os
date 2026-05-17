# AgenticOS Claude Rules

These rules adapt the canonical project context for Claude Code sessions.

Always read or rely on:

- `CLAUDE.md` for the full architecture and local change guidance.
- `.agenticos-project/project.md` for product scope.
- `.agenticos-project/rules/safety.md` for approval gates.
- `.agenticos-project/rules/artifacts.md` for durable output rules.
- `tests/README.md` for the current test strategy.

Project boundaries:

- AgenticOS is local-first.
- `vault/` is user memory and generated artifacts.
- `.agenticos/agenticos.sqlite` is local runtime state.
- `.agenticos-project/` is versioned model context.
- `.env.local` is private.

Change discipline:

- Prefer narrow edits in owner modules.
- Preserve approval gates and audit logs.
- Use existing UI primitives in `components/ui/*`.
- Use existing repository functions instead of raw SQL in pages/routes.
- Run verification appropriate to the changed layer.
