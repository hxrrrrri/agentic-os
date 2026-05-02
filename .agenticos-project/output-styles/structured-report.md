# Output Style: Structured Report

Use for research, planning, audits, technical investigations, project summaries, and any task where the user needs to understand the reasoning, evidence, and tradeoffs — not just the conclusion. The Structured Report is designed to be read, shared, and referenced. It must be navigable, specific, and self-contained.

---

## When to Apply

Apply Structured Report when:
- The task produces findings that need to be evaluated, not just consumed.
- Multiple options, sources, or perspectives need to be compared.
- The output will be shared with others or referenced in future sessions.
- Reasoning must be visible — the user needs to audit the logic, not just accept the conclusion.
- The task is a plan, audit, research synthesis, or project status review.

Do not apply Structured Report when:
- The user asks for a simple direct answer.
- The deliverable is a content artifact (use Artifact First instead).
- The task is brief enough that structure would add more friction than value.

---

## Canonical Format

Every Structured Report uses this section order. Omit sections that have no content — do not include empty sections. Do not reorder sections.

```markdown
# [Report Title]

> [One-line summary — the single most important thing to know from this report]

## Executive Summary
[3–5 sentences. What was investigated, what was found, and what the user should do about it.
Written for someone who will read only this section. Must stand alone.]

## Key Findings

### [Finding 1 — descriptive title]
[Specific finding with evidence or reasoning. Not a category — a concrete observation.]
[Source or basis for this finding, if applicable.]

### [Finding 2 — descriptive title]
[Repeat pattern]

[Minimum 3 findings for research and audit reports. Quality over quantity.]

## Evidence or Reasoning
[For research: sources, evidence table, confidence levels.
For plans: step-by-step logic, dependency map.
For audits: specific file references, test results, observed vs. expected behavior.
This section justifies the findings — do not skip it.]

## Risks and Assumptions
[What could invalidate the findings, what assumptions were made, what is uncertain.
For each risk: probability estimate (high / medium / low) and potential impact.]

## Recommendations
[Specific, executable actions based on findings. Numbered. Each recommendation must be:
- Specific enough to act on without clarifying questions.
- Tied to one or more findings in the report.
- Labeled with a priority: P1 (do now) / P2 (do soon) / P3 (consider later).]

## Next Actions
[The 2–5 most important immediate steps. Concrete and ordered by priority.
Different from Recommendations — these are the specific first moves, not the full strategy.]
```

---

## Section-by-Section Standards

### Executive Summary
- Written last, placed first.
- Must answer: what was investigated, what the key finding is, and what to do.
- If a busy stakeholder reads only this, they should make the right decision.
- Maximum 5 sentences. No hedging. No caveats that belong in Risks.

### Key Findings
- Each finding is a specific, named observation — not a topic category.
- Bad: "Authentication has some issues."
- Good: "`checkPermission()` returns `true` when `role` is `undefined`, allowing unauthenticated users to access admin routes."
- Each finding must be independently understandable without reading other findings.
- Order by importance, not by how they were discovered.

### Evidence or Reasoning
- For research: cite every claim. Include source name, date, credibility tier.
- For code reviews: reference specific files and line numbers.
- For plans: show why each step depends on the previous one.
- This section is what makes the report auditable. Do not summarize — show the work.

### Risks and Assumptions
- Name every assumption that, if wrong, would change the recommendations.
- For each risk: what it is, how likely it is, and what it would affect.
- Do not bury risks in the main content sections. Surface them explicitly here.

### Recommendations
- Each recommendation maps to at least one finding. If a recommendation has no finding behind it, remove it.
- P1 recommendations should be completable within the current work session or day.
- P2 recommendations should have a clear owner and timeframe.
- P3 recommendations are tracked but not urgent.

### Next Actions
- This is the operational handoff from the report to execution.
- If someone reads only the Executive Summary and the Next Actions, they should know exactly what to do and in what order.
- Maximum 5 items. If more than 5 actions are needed, the P1 Recommendations section covers the rest.

---

## Formatting Rules

- Use H2 (`##`) for top-level sections. Use H3 (`###`) for findings and subsections within a section.
- Use tables for comparisons, evidence matrices, and status trackers.
- Use numbered lists for sequential steps and prioritized recommendations.
- Use bullet lists for parallel facts, options, or observations.
- Code references use inline code formatting: `path/to/file.ts:42`.
- Never use a wall of prose where a table or list would be more readable.
- Never use bold for decoration. Bold means: this is the most important thing on this line.

---

## Quality Check

Before delivering a Structured Report, verify:
- [ ] Executive Summary stands alone and answers what-was-found and what-to-do.
- [ ] Every finding is specific, not categorical.
- [ ] Every recommendation is tied to a finding and executable without clarification.
- [ ] Evidence section cites sources or references specific code locations.
- [ ] Risks section names assumptions explicitly.
- [ ] Next Actions are ordered by priority, not by discovery order.
- [ ] No empty sections included.
