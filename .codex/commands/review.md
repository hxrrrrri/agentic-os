# Review Command

Purpose: review current changes without modifying them unless the user asks for fixes.

Steps:

1. Run `git status --short`.
2. Inspect diffs for changed source files.
3. Read owner modules and matching tests.
4. List findings first, ordered by severity.
5. Run or recommend the minimum verification command.

Output:

```text
Findings
- [severity] file:line - issue

Open Questions
- ...

Verification
- command: result
```
