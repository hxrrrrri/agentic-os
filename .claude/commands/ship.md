---
description: Prepare AgenticOS changes for handoff without pushing or deploying
---

Prepare the current change set for local handoff. Do not push, deploy, install packages, or mutate external systems.

Checklist:

1. Confirm `git status --short`.
2. Confirm whether changes are docs-only or source-affecting.
3. For source changes, run `npm run typecheck`.
4. For UI/API/runtime changes, run `npm run lint` and consider `npm run build`.
5. Check that `.env.local`, `vault/`, `.agenticos/`, SQLite files, and local settings are not being committed.
6. Summarize changed files, verification, and any known residual risk.

Arguments: `$ARGUMENTS`
