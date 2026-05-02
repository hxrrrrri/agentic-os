# Artifact Rules

Every useful AgenticOS output must become a durable, retrievable artifact. Transient in-memory summaries that cannot be found, reused, or built upon are not acceptable as the final product of a run that took real time and compute.

---

## When to Save an Artifact

Save a vault artifact whenever the output is any of the following:

| Output Type | Save Location |
|---|---|
| Research reports, source syntheses, competitive analyses | `/vault/wiki` |
| Content drafts: scripts, posts, carousels, newsletters, blogs | `/vault/content` |
| Plans, specs, architecture decisions, implementation proposals | `/vault/projects` |
| Project snapshots, status updates, weekly reviews | `/vault/projects` |
| Daily notes, morning briefs, meeting prep, agendas | `/vault/daily` |
| Approval packets, staged commands, risk assessments | `/vault/runs` |
| Code review notes, audit findings, release checklists | `/vault/projects` |
| Reusable prompts, skill templates, workflow definitions | `/vault/memory` |
| Any output the user is likely to want to reference later | `/vault/runs` (fallback) |

**When in doubt, save.** A saved artifact that turns out to be unnecessary costs one file. A lost artifact costs the entire run.

---

## Required Artifact Structure

Every saved artifact must include all applicable sections. Empty sections should be omitted — do not include a section just to leave it blank.

```markdown
# [Title]

> **Date:** [ISO date or run timestamp]
> **Skill:** [Skill name, if applicable]
> **Run ID:** [Run ID, if available]
> **Status:** [draft | reviewed | approved | archived]

## Summary
[2–4 sentences. What is this, why does it exist, and what is the key takeaway?]

## [Main Output Section]
[The primary content — research, draft, plan, review, etc. Use headings appropriate to the content type.]

## Decisions and Assumptions
[Key choices made during generation. Constraints, scope limitations, or data gaps that affect interpretation.]

## Sources
[For research artifacts: list every source with name, URL if available, and a one-line credibility note.]

## Next Actions
[Numbered list of specific, executable follow-up steps. Not vague suggestions — concrete actions.]
```

---

## Artifact Quality Standards

### Do

- Use clear, descriptive titles that identify the topic and date without needing to open the file.
- Write the summary as if it is the only thing the reader will see. Make it stand alone.
- In the main output section, use headings, tables, and lists — not paragraphs of prose.
- In research artifacts, cite every claim that comes from an external source.
- In approval packets, include the exact command or payload — not a paraphrase of it.
- In content drafts, include platform-specific formatting (character counts, hashtags, CTA placement).

### Do Not

- Save empty generic summaries that say "the workflow completed successfully" with no substance.
- Claim in the artifact that external tools ran when they were simulated. Label simulated output clearly.
- Write unstructured prose blobs with no headings, lists, or navigable sections.
- Include API keys, passwords, or tokens in any artifact.
- Create duplicate artifacts for the same run unless the content is meaningfully different.
- Use vague next actions like "review the output" — say what specifically to review and what to decide.

---

## Artifact Naming Convention

File names follow this pattern:

```
YYYY-MM-DD-[slug-from-title].md
```

Examples:
- `2026-05-02-deep-research-ai-agent-frameworks.md`
- `2026-05-02-content-cascade-productivity-hooks.md`
- `2026-05-02-approval-packet-github-push-main.md`

Slugs must be lowercase, hyphenated, and under 72 characters total. The date prefix ensures chronological sort order in any file explorer.

---

## Memory Indexing

After saving an artifact, it must be indexed for retrieval by future runs. The index entry should capture:

- The artifact title and vault path.
- 2–3 tags from the skill category and content type.
- A one-sentence description of what the artifact contains.

This turns the vault from a write-only archive into a searchable knowledge base that improves the quality of future runs.
