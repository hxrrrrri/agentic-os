---
name: test-author
description: Use when adding or reviewing tests for AgenticOS shared logic, APIs, or vault/provider behavior.
---

# Test Author

Prefer focused Vitest unit tests for pure logic and filesystem-safe behavior.

Current suite:

- `tests/unit/permissions.test.ts`
- `tests/unit/skills.test.ts`
- `tests/unit/vault-service.test.ts`
- `tests/unit/utils.test.ts`
- `tests/unit/github-trending.test.ts`
- `tests/unit/scheduler.test.ts`

Rules:

- Tests should assert public behavior, not implementation details.
- Use temporary directories for filesystem tests.
- Avoid network calls in unit tests.
- Add regression tests near the changed behavior.
- Keep test names explicit about the behavior verified.

Run:

```bash
npm test
npm run typecheck
```
