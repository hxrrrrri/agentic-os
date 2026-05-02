# Skill: Project Snapshot

Use to capture the current state of a project, codebase, or initiative as a durable, referenceable artifact. A Project Snapshot is not a changelog — it is a structured situational briefing that answers: where are we, how did we get here, what is blocking us, and what happens next.

Run this skill at the start of a new session, before a handoff, at the end of a sprint, or any time the project state needs to be externalized for future reference or collaboration.

---

## When to Use This Skill

- Starting a new work session and needing to reload context quickly.
- Handing off a project to another person or agent.
- End of a sprint, milestone, or significant phase.
- After a major architectural decision that needs to be recorded.
- Before a long break, when context would otherwise be lost.
- Creating a memory artifact that future runs can reference via `memory-search`.

---

## Execution Instructions

### Phase 1 — Context Collection
Gather the following before writing anything:

1. **Current objective:** What is the project trying to achieve right now? Not the long-term vision — the active goal for the current sprint, session, or phase.
2. **Scope boundaries:** What is explicitly in scope for the current phase? What is deferred?
3. **Completed work:** What was finished since the last snapshot (or from the beginning)? Be specific — file names, feature names, decisions made. Vague "made progress on auth" is not acceptable.
4. **Active work:** What is currently in progress? Who or what is working on it?
5. **Key files and modules:** Which files are most relevant to the current objective? List them with a one-line description of their role.
6. **Decisions made:** What architectural, product, or technical decisions were made, and what were the alternatives considered? Decisions without rationale rot quickly.
7. **Assumptions:** What is being assumed to be true that has not been verified? Flag each assumption explicitly.
8. **Blockers:** What is preventing forward progress? For each blocker: what it is, what unblocks it, and who or what is responsible.
9. **Known debt:** What shortcuts, workarounds, or incomplete implementations exist that will need revisiting?
10. **Next actions:** What are the next 3–5 specific, executable steps? Not vague directions — concrete tasks.

### Phase 2 — Write Snapshot
Produce the structured snapshot using the format below.

### Phase 3 — Save and Index
Save to `/vault/projects/[YYYY-MM-DD]-snapshot-[project-slug].md`.
Index with tags: `project`, `snapshot`, `[project name]`, `[phase or milestone name]`.

---

## Required Output Format

```markdown
# Project Snapshot: [Project Name]

> **Date:** [ISO date] · **Phase:** [Current phase or milestone] · **Skill:** Project Snapshot

## Current Objective
[One sentence: what the project is achieving in the current phase]

## Scope
**In scope:** [What is being worked on now]
**Deferred:** [What is explicitly out of scope for this phase]

## Completed

| Item | Description | Date |
|---|---|---|
| [Feature/fix/decision] | [What was done] | [Date] |

## Active Work

| Item | Status | Owner / Agent | Notes |
|---|---|---|---|
| [Task] | [in-progress / blocked / review] | [who] | [context] |

## Key Files and Modules

| Path | Role |
|---|---|
| `[path]` | [One-line description of what this file does] |

## Decisions Made

### [Decision Title]
**Decision:** [What was decided]
**Rationale:** [Why this option was chosen]
**Alternatives considered:** [What else was evaluated and why it was rejected]
**Consequences:** [What this decision locks in or forecloses]

[Repeat for each significant decision]

## Assumptions
[Numbered list. Each assumption must be flagged as: unverified / partially verified / verified]
1. [Assumption] — [verification status]

## Blockers

| Blocker | Impact | Unblocked By | Owner |
|---|---|---|---|
| [Description] | [What it prevents] | [What needs to happen] | [Who resolves] |

## Known Debt

| Item | Location | Priority | Notes |
|---|---|---|---|
| [Shortcut or workaround] | `[file or area]` | [high/medium/low] | [When to address] |

## Next Actions
1. **[Action]** — [specific task, file, or decision] — [owner if known]
2. **[Action]** — ...
3. **[Action]** — ...

## Open Questions
[Questions that need answers before the next phase can begin]
```

---

## Quality Standards

- **Specificity over coverage.** A snapshot with 3 specific completed items is more useful than 10 vague ones. "Implemented JWT authentication in `lib/auth/jwt.ts` with 15-minute expiry" beats "worked on auth."
- **Decisions must include rationale.** A decision without its reasoning becomes misleading the moment the context changes. Future agents or collaborators need to know *why*, not just *what*.
- **Blockers must be actionable.** "Waiting on API docs" is not a blocker entry. "Cannot implement Stripe webhook handler — API docs for `payment_intent.succeeded` event payload not found. Unblocked by: locating docs at stripe.com/docs/webhooks or asking Stripe support" is.
- **Next actions must be executable.** "Keep working on the feature" is not a next action. "Add input validation to `POST /api/runs` in `app/api/runs/route.ts` before the `zod.parse()` call" is.
- **Do not summarize what the user already knows.** The snapshot is for future reference — write for the person (or agent) who has no current context, not for the person who is reading it right now.
