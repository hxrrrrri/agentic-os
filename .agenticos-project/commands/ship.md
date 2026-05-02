# Command: /ship

Use this command when a software change needs to be assessed, validated, and prepared for delivery. Ship does not mean "push." Ship means the change is understood, verified, documented, and staged for release — with explicit approval required before any external action.

---

## When to Use

- A feature, fix, or refactor is ready to move toward production.
- A PR needs a release note, summary, or deployment checklist.
- The user wants to know if the change is safe to merge or deploy.

---

## Workflow

### Step 1 — Characterize the Change
- What is the intent of this change? (feature / fix / refactor / config / dependency update)
- Which files were touched? List them with a one-line description of what changed in each.
- What behavior changes from the user's perspective?
- What behavior is unchanged?
- Are there any breaking changes to APIs, types, or interfaces?

### Step 2 — Risk Assessment
- Does this touch authentication, authorization, payments, data storage, or external integrations?
- Does this change database schema, migrations, or data access patterns?
- Does this affect any shared infrastructure, environment variables, or secrets?
- What is the worst-case failure mode if this change has a bug?

### Step 3 — Verification Checklist
Run the following checks and report results explicitly. Do not assume they passed.

```
[ ] Lint — zero errors, zero ignored rules covering changed files
[ ] Type check — zero type errors in changed files and their dependents
[ ] Build — production build completes without error
[ ] Unit tests — all tests pass, no skipped tests in changed areas
[ ] Integration tests — if applicable, key flows pass
[ ] Manual smoke test — golden path verified in a local environment
[ ] Environment variables — no new required vars missing from .env.example
[ ] No secrets committed — verified with a secret scanner or manual audit
```

For any failing check: report the exact error, the file and line, and the precise fix needed. Do not suggest "investigate the error" — identify it.

### Step 4 — Release Documentation
Produce a release artifact containing:

```markdown
## Release: [Change Title]
**Date:** [ISO date]
**Type:** [feature | fix | refactor | dependency | config | breaking]
**Risk:** [low | medium | high]
**Author:** [if known]

### Summary
[2–3 sentences. What changed and why. Written for a teammate who did not touch this code.]

### Files Changed
| File | Change |
|---|---|
| [path] | [one-line description] |

### Breaking Changes
[List any breaking changes, or "None."]

### Migration Steps
[If this requires config changes, data migrations, or env var additions — list them here with exact steps.]

### Rollback Plan
[How to revert this change if it causes issues in production]

### Verification
[What to check after deployment to confirm it worked correctly]
```

### Step 5 — Approval Request
If the next step involves pushing, merging, deploying, or publishing — generate an approval packet. Include:
- Exact command(s) to execute.
- Environment affected.
- Rollback procedure.
- Who needs to approve (if known).

Do not execute any external action until the user explicitly approves.

---

## Safety Gates

These actions require explicit approval — never auto-execute:

- `git push` to any branch on a remote.
- Opening, merging, or closing a pull request.
- Triggering any CI/CD pipeline or deployment.
- Running database migrations.
- Publishing packages to npm, PyPI, or any registry.
- Modifying environment variables in a live environment.

---

## Output Quality Standard

The ship command output is a decision document. Someone who did not write the code must be able to read it and make a confident go/no-go decision. Every section must be specific. Vague summaries ("the code looks good") fail this standard.
