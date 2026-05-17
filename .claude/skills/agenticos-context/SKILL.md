---
name: agenticos-context
description: Use when orienting a Claude session, updating project instructions, or checking whether a change fits AgenticOS architecture.
---

# AgenticOS Context

Use this skill to quickly align with the project before making changes.

Read in this order:

1. `CLAUDE.md`
2. `codex.md`
3. `.agenticos-project/project.md`
4. `.agenticos-project/rules/safety.md`
5. The owner module for the requested change

Key architecture:

- Next.js App Router in `app/`.
- Shared React components in `components/`.
- Agent runtime in `lib/agent/`.
- SQL.js persistence in `lib/db/`.
- Vault and memory in `lib/vault/` and `lib/memory/`.
- Permission gates in `lib/permissions/policy.ts`.
- Portable model context in `.agenticos-project/`.

When done, state which layer owns the work and which verification command is appropriate.
