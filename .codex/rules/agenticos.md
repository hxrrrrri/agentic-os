# AgenticOS Codex Rules

Use `codex.md` as the Codex-specific entrypoint and `CLAUDE.md` as the full architecture reference.

Project boundaries:

- Local-first by default.
- Runtime state lives in `vault/` and `.agenticos/`.
- `.agenticos-project/` is versioned provider-agnostic context.
- Risky actions require approval.
- Secrets stay out of logs, artifacts, and final answers.

Implementation rules:

- Prefer existing owner modules over new abstractions.
- Keep edits narrow.
- Update types, DB mapping, API routes, and UI consumers together when contracts change.
- Add focused tests when touching shared logic.
- Preserve user changes in the working tree.
