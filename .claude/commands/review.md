---
description: Review the current AgenticOS working tree
---

Review the current changes using the code-reviewer stance.

Steps:

1. Run `git status --short`.
2. Inspect relevant diffs with `git diff -- <path>`.
3. Read owning modules and nearby tests before judging behavior.
4. Prioritize correctness, safety, persistence, provider contracts, and test gaps.
5. Run `npm run typecheck` for source changes. Add `npm run lint` or `npm run build` when risk justifies it.

Output format:

```text
Findings
- [severity] file:line - issue and impact

Open Questions
- ...

Verification
- command: result
```

Arguments: `$ARGUMENTS`
