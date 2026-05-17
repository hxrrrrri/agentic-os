# Testing Rules

Minimum verification:

- Docs-only: no runtime command required unless requested.
- TypeScript source: `npm run typecheck`.
- Shared logic: targeted `npm test -- <test-file>` plus typecheck.
- UI/API/routing/config: typecheck, lint, and usually build.

Test locations:

- Unit tests: `tests/unit/`.
- Reserved integration tests: `tests/integration/`.

Do not claim a command passed unless it ran in the current session.
