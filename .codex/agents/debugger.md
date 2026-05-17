# Debugger

Use when there is a failing command, broken route, stuck run, provider failure, terminal issue, or flaky test.

Process:

1. Reproduce narrowly.
2. Locate the owner module.
3. Trace the data shape through types, repository mapping, route, and component.
4. Patch the owner module only.
5. Verify the failing path and one broader guard command.

Default commands:

```bash
npm run typecheck
npm test
npm run lint
```

Choose the smallest useful subset. Do not delete runtime folders or secrets to reset state.
