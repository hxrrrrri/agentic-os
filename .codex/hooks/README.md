# Codex Hooks

This directory is reserved for future local automation notes.

No hooks are active. That is intentional because automatic hooks can modify files, block commands, or create noisy output. Add hook scripts only when a concrete Codex workflow supports them and the behavior is agreed.

Good candidates:

- Check that `.env.local`, `vault/`, and `.agenticos/` are not included in handoff.
- Remind after TypeScript edits to run `npm run typecheck`.
- Summarize failed tests into a small markdown artifact.
