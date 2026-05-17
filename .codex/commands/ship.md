# Ship Command

Purpose: prepare a local handoff for AgenticOS changes. Do not push, deploy, or install dependencies.

Checklist:

1. `git status --short`
2. Verify local-only files are not included: `.env.local`, `vault/`, `.agenticos/`, SQLite, local settings.
3. Run `npm run typecheck` for TypeScript changes.
4. Run `npm run lint` for broader source changes.
5. Run `npm run build` for routing, server component, config, or release-sensitive changes.
6. Summarize changed files, verification, and remaining risk.
