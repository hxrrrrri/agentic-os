# Tests

Vitest unit tests for AgenticOS.

## Run

```bash
npm test            # one-shot
npm run test:watch  # watch mode
```

## Layout

- `tests/unit/` — pure-function unit tests (no DB, no network, no filesystem outside `os.tmpdir()`).
- `tests/integration/` (reserved) — API route tests that boot the Next dev server, run against a temp vault and SQLite.
- `tests/.last-results.json` — written by Vitest after each run; consumed by the `/tests` UI panel.

## Coverage

This is the bootstrap suite — critical paths only. Add tests next to new code as you go. Critical paths covered now:

- `lib/permissions/policy` risk + approval rules
- `lib/skills/registry` lookup + classification
- `lib/vault/service` path-traversal defence + wikilink extraction
- `lib/utils` slug, formatting, id helpers
- `lib/integrations/github-trending` returns array or null, never throws
- `lib/scheduler` natural-language → cron parser

## Next steps

- Add `tests/integration/api-runs.test.ts` (boots Next, posts `/api/runs`, asserts run completes).
- Add `tests/integration/api-vault.test.ts` (POST `/api/vault`, asserts file created in temp vault).
- Add `tests/integration/api-mcp.test.ts` (asserts MCP command whitelist rejects unknown binaries once that policy lands).
- Wire into CI: `npm test` returns non-zero on failure.
