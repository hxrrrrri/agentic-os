# Skill: Deep Research

Use for source-aware research tasks that require synthesis, citation, and a structured final report — not quick answers or surface-level overviews. Deep Research is the appropriate skill when a decision, publication, or knowledge-base entry depends on the quality and accuracy of the findings.

---

## When to Use This Skill

- Competitive analysis, market sizing, or technology landscape mapping.
- Technical investigation where multiple sources need to be compared and reconciled.
- Background research before writing a long-form content asset.
- Answering a question where the answer is contested, evolving, or source-dependent.
- Building a knowledge-base entry that will be referenced in future runs.

**Do not use this skill for:** simple factual lookups, internal vault queries (use `memory-search`), or creative tasks that do not require external sources.

---

## Execution Instructions

### Phase 1 — Question Definition (do not skip)
Before gathering any sources:
1. Restate the research question precisely. If the user's input is ambiguous, state the interpretation chosen.
2. Define scope: what topics are in scope, what are explicitly out of scope?
3. Define the success criterion: what will a complete answer enable the user to do?
4. Identify the source types most likely to contain authoritative answers for this question.

### Phase 2 — Source Gathering
5. Identify at minimum 3 independent sources. For contested or fast-moving topics, seek 5–8.
6. Apply the source tier hierarchy:
   - **Tier 1:** Primary sources — original research, official docs, raw data, direct statements from authors or organizations.
   - **Tier 2:** Expert analysis — peer-reviewed papers, recognized domain experts, established institutions.
   - **Tier 3:** Reputable secondary — major publications, industry reports with named methodology.
   - **Tier 4:** General secondary — blogs, forums, articles. Use only when higher tiers are unavailable. Label clearly.
   - **Tier 5:** AI-generated content — treat as a lead only. Never cite as factual source.
7. For each source, record: name, URL, publication date, author or organization, credibility tier.
8. Note potential bias or conflict of interest for each source.

### Phase 3 — Evidence Extraction and Evaluation
9. Extract the specific claim or data point from each source — not the full article.
10. Separate: **verified fact** / **strong inference** / **weak inference** / **speculation**. Label each explicitly.
11. Identify where sources agree (foundation of the answer) and where they conflict (requires reconciliation).
12. For conflicts: report both positions, explain the nature of the disagreement, and state which is better supported and why.

### Phase 4 — Synthesis
13. Write the Direct Answer first — the best available answer to the research question in 2–5 sentences.
14. Calibrate confidence explicitly: `high` (multiple corroborating primary sources), `medium` (limited or secondary sources), `low` (thin evidence, contested, or rapidly changing).
15. List Key Findings: each finding is a specific, sourced claim — not a category.
16. Identify open questions this research raised but did not resolve.
17. Produce specific, executable recommendations based on findings.

### Phase 5 — Save Artifact
18. Save the complete research report to `/vault/wiki/[YYYY-MM-DD]-[topic-slug].md`.
19. Index the artifact with category tags: `research`, `[topic-domain]`, and the primary question keywords.

---

## Required Output Format

```markdown
# Research Report: [Topic]

> **Date:** [ISO date] · **Skill:** Deep Research · **Confidence:** [high | medium | low]

## Research Question
[Precise restatement of what was investigated and why]

## Direct Answer
[Best available answer — 2–5 sentences. Lead with the finding, not caveats.]
**Confidence:** [high | medium | low] — [one-sentence justification]

## Key Findings

### [Finding Title]
[Specific finding with context]
**Source:** [Name · URL · Date · Tier]
**Confidence:** [H/M/L]

[Repeat for each major finding — minimum 3]

## Evidence Table

| Claim | Source | Tier | Confidence | Caveat |
|---|---|---|---|---|

## Conflicts and Uncertainty
[Where sources disagree, where evidence is thin, or where the answer is contingent on unconfirmed assumptions]

## Recommendations
[Specific, executable next steps based on findings]

## Open Questions
[Questions this research raised but could not answer — with suggestions for how to resolve each]

## Sources
[Full list: Name · URL · Date · Credibility tier · One-line note]
```

---

## Quality Standards

- Every claim in Key Findings must have a source citation. Uncited claims do not belong in this section.
- Never fabricate URLs. If a source cannot be linked, describe it without a URL.
- If the research is inconclusive, say so. A well-characterized uncertainty is more valuable than a confident wrong answer.
- Recency must be noted. For technology and markets, flag any source older than 12 months as potentially stale.
- The synthesis section must reconcile conflicting sources — not just list them both without evaluation.
