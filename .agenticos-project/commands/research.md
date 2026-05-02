# Command: /research

Use this command when the task requires gathering information from multiple sources, synthesizing evidence, and producing a cited answer. Research does not mean "search and paste." It means the answer is evaluated, sourced, calibrated for uncertainty, and structured for reuse.

---

## When to Use

- The user asks "what is," "how does," "compare," "research," or "investigate."
- Market intelligence, competitive analysis, or technical evaluation is needed.
- The user needs a cited report rather than a quick answer.
- A decision depends on external information that needs verification.
- Multiple conflicting sources need to be reconciled.

---

## Workflow

### Step 1 — Frame the Question
Do this before searching for anything.

- Restate the research question in precise terms. What exactly is being asked?
- Define the scope: breadth (how many subtopics?), depth (surface overview or detailed analysis?), and recency (how current must the information be?).
- Identify what a successful answer looks like. What will the user be able to do once they have this information?
- Surface ambiguities. If the question could mean multiple things, state the interpretation chosen — or ask for clarification if the interpretation choice significantly affects the output.

### Step 2 — Source Strategy
Before searching, plan the source approach:

- What types of sources are appropriate for this question? (primary data, official docs, expert analysis, industry reports, practitioner accounts)
- What sources would be inappropriate or low-credibility? (identify and exclude upfront)
- Are there known authoritative sources in this domain? Name them.
- What is the acceptable age range for sources? (For fast-moving topics: 6–12 months. For stable topics: up to 5 years.)

### Step 3 — Gather and Evaluate
For each source found:
- Record: name, URL if available, publication date, author or organization.
- Assess credibility tier (1 = primary/official → 5 = AI-generated or unverified).
- Extract the specific claim or data point that is relevant.
- Note any bias, conflict of interest, or methodology limitation.

### Step 4 — Synthesize
- Identify where sources agree: these form the foundation of the answer.
- Identify where sources disagree: report both positions, explain the conflict, and state which is better supported and why.
- Separate: verified fact / strong inference / weak inference / speculation. Label each explicitly.
- Do not pad with excerpts. The synthesis is the deliverable — not a collection of quotes.

### Step 5 — Produce and Save
Generate the final research report using the structured format below.
Save to `/vault/wiki/[YYYY-MM-DD]-[topic-slug].md` when the report is reusable.

---

## Output Format

```markdown
## Research Report: [Topic]

**Date:** [ISO date]
**Question:** [Precise restatement]
**Scope:** [Breadth, depth, recency constraint]

---

## Direct Answer
[The best available answer to the research question. 2–5 sentences. Lead with the finding.]
[Confidence: high | medium | low — one-sentence justification]

## Key Findings

### [Finding Title]
[Specific finding with source attribution]
**Source:** [Name, URL, date, tier]
**Confidence:** [H/M/L] — [justification]

[Repeat for each major finding]

## Conflicts and Uncertainty
[Where sources disagree, where evidence is thin, or where the answer depends on unconfirmed assumptions]

## Evidence Table

| Claim | Source | Tier | Confidence | Caveat |
|---|---|---|---|---|
| [Claim] | [Source] | [1–5] | [H/M/L] | [Bias, date, or limitation] |

## Recommendations
[Based on findings: what should the user do, decide, or investigate next?]

## Follow-up Questions
[Questions this research raised but did not answer]

## Sources
[Full list: Name · URL · Date · One-line credibility note]
```

---

## Standards

- **Lead with the answer.** Never make the user read to the end to find the conclusion. State it first.
- **No fabricated citations.** If a URL cannot be verified, describe the source without linking. A described real source is better than a fabricated URL.
- **No false certainty.** If evidence is thin or conflicting, say so. Label confidence levels explicitly.
- **Recency matters.** For technology, markets, and regulation — a 2-year-old source can be actively misleading. Always note publication date.
- **Synthesize, do not aggregate.** A list of excerpts from 10 sources is not a research report. A paragraph that reconciles those sources, names where they agree and disagree, and draws a calibrated conclusion is.
- **Save when reusable.** If this research could inform future runs, write the artifact to vault. Do not produce a research report and let it evaporate.
