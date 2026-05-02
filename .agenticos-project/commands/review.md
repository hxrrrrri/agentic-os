# Command: /review

Use this command when code, a PR, a design, or a plan needs a structured critical assessment. Review does not mean "read and comment." It means findings are surfaced, prioritized by severity, and actionable without additional context.

---

## When to Use

- A PR, diff, or set of files needs review before merge.
- The user asks "is this right," "what could go wrong," "is this safe," or "review this."
- A design decision, API contract, or data schema needs evaluation.
- A plan or specification needs a logic and feasibility check.

---

## Workflow

### Step 1 — Scope the Review
Before examining anything, establish:
- What is being reviewed? (specific files, a diff, a full PR, a design doc)
- What is the review goal? (correctness, security, performance, readability, release readiness)
- What context is needed? (related code not in the diff, existing tests, known constraints)

If scope is unclear, state what was assumed.

### Step 2 — Systematic Examination
Examine in this order. Do not skip tiers because earlier tiers found nothing.

**Tier 1 — Correctness and Safety (examine first, always)**
- Logic errors: off-by-one, incorrect conditionals, wrong variable used, unreachable branches.
- Security: injection vulnerabilities, broken auth, exposed secrets, path traversal, unsafe deserialization.
- Data integrity: writes that can corrupt, missing transactions, state that can become inconsistent.
- Type errors: silent coercions, incorrect type assertions, unchecked external data shapes.

**Tier 2 — Reliability**
- Error handling: are error states handled at all system boundaries?
- Resource management: are connections, file handles, and subscriptions cleaned up?
- Edge cases: empty input, zero values, null/undefined, concurrent access, network failure.
- Regressions: does this change break behavior that existing callers depend on?

**Tier 3 — Maintainability**
- Naming: are identifiers clear enough that a reader understands intent without comments?
- Complexity: are functions doing more than one thing? Are they testable in isolation?
- Test coverage: are the critical paths tested with meaningful assertions?
- Documentation: are non-obvious behaviors commented? Are public interfaces documented?

**Tier 4 — Style**
- Only flag style issues if they block readability or are inconsistent with the project linter config.
- Do not flag personal preferences.

### Step 3 — Produce Findings
See the output format below.

### Step 4 — Summarize Risk
After findings: state what risks remain even if all issues are fixed. This might include:
- Untested integration paths.
- Dependency on external system behavior.
- Known limitations the team should track.

---

## Output Format

```markdown
## Review Scope
[What was reviewed. Files, line ranges, or diff description.]

## Verdict
[Approve | Request changes | Block]
[One sentence explaining the verdict.]

---

## Findings

### [P0/P1/P2/P3] — [Issue Title]
**Location:** `path/to/file.ts:42`
**Problem:** [Precise description — what the code does, why it is wrong, what fails]
**Impact:** [What breaks or becomes exploitable]
**Fix:** [Specific code change or behavior description]

[Repeat for each finding, severity descending]

---

## Test Gaps
[Critical paths or edge cases that lack test coverage. Specific, not generic.]

## Residual Risk
[Risks that remain after all findings are resolved.]
```

---

## Standards

- **File:line references are mandatory** for every P0 and P1 finding.
- **Generic praise is prohibited.** "Looks good overall" is not review output.
- **If there are no issues, say so directly.** State the verdict, state the test gaps, state the residual risk. A clean review is valuable output.
- **Severity must be justified.** If a finding is P0, explain why in one sentence. "This could expose user data" is a justification. "This is bad" is not.
- **Do not review code that was not shown.** Only comment on code present in the review scope. If related unseen code creates risk, name the file and explain the concern — but do not make up specific bugs in unseen code.
