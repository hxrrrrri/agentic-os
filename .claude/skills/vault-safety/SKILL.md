---
name: vault-safety
description: Use when changing vault, memory, markdown artifact, path resolution, graph, conflict, or promotion behavior.
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

- All user-provided paths must go through `resolveVaultPath()`.
- Keep writes inside `agenticosConfig.vaultPath`.
- Do not delete or rewrite user notes without an explicit request.
- Preserve wiki-link extraction behavior unless graph changes are intentional.
- Treat `vault/` as runtime user data, not source code.

Verification:

```bash
npm test -- tests/unit/vault-service.test.ts
npm run typecheck
```
