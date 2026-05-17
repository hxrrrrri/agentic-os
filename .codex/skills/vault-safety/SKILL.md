---
name: vault-safety
description: Use when changing vault, memory, markdown artifact, path resolution, graph, conflict, or promotion code.
---

# Vault Safety

Relevant files:

- `lib/vault/service.ts`
- `lib/vault/graph.ts`
- `lib/vault/conflict.ts`
- `lib/vault/patterns.ts`
- `lib/vault/promote.ts`
- `lib/memory/indexer.ts`
- `app/api/vault/*`
- `components/vault/*`

Rules:

- Route all user paths through `resolveVaultPath()`.
- Keep writes inside `agenticosConfig.vaultPath`.
- Do not delete user notes unless explicitly requested.
- Preserve wikilink behavior when changing graph code.
- Treat `vault/` as local runtime data.

Run:

```bash
npm test -- tests/unit/vault-service.test.ts
npm run typecheck
```
