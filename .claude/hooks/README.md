# Claude Hooks

This directory is reserved for Claude Code hook scripts and hook documentation.

No hooks are registered in `.claude/settings.json` yet. That is intentional: automatic hooks can block tool use, run formatters, or modify files every time Claude acts. Add them only when the exact event, matcher, command, and failure behavior are agreed.

Useful future hooks for this project:

- Pre-tool guard for dangerous shell commands outside the repository.
- Post-edit reminder to run `npm run typecheck` after TypeScript changes.
- Session-start reminder to read `CLAUDE.md`, `codex.md`, and `.agenticos-project/project.md`.
- Completion notification for long-running build or test tasks.

Keep hook scripts small, deterministic, and free of secrets.
