# Skill: Approval Packet

Use when a requested action requires explicit user authorization before execution. An Approval Packet is not a summary of what might happen — it is a precise, reviewable record of what will happen, formatted so the user can make an informed go/no-go decision without needing to ask follow-up questions.

The approval packet is the mandatory output for any action classified as `high` or `critical` risk. It must be produced before any execution attempt — not after a failed one.

---

## When to Use This Skill

- Any action that sends messages, posts content, or notifies external parties.
- Any action that modifies, deletes, or moves files outside the vault.
- Any action that pushes code, triggers deployments, or modifies infrastructure.
- Any action that creates, modifies, or cancels financial records (charges, subscriptions, refunds).
- Any action that reads, writes, or rotates secrets or credentials.
- Any action that modifies external system records (CRM, database, SaaS config).
- Any action the user explicitly asks to stage for review before running.

---

## Execution Instructions

### Step 1 — Identify the Action
Before writing the packet, be precise about what will happen:
- What is the exact action? (not a category — the specific operation)
- What system or resource does it affect?
- Is this reversible? If yes: how? If no: state that explicitly.
- What is the worst-case outcome if this goes wrong?

### Step 2 — Classify the Risk

| Level | Criteria | Default Handling |
|---|---|---|
| **low** | Read-only, local, fully reversible | Auto-execute (no packet needed) |
| **medium** | Local writes, staged commands, non-financial external reads | Dry-run with packet |
| **high** | Sends data externally, modifies records, pushes code | Approval packet required |
| **critical** | Financial mutations, secret access, production deploys, bulk deletes, irreversible | Approval packet + explicit confirmation phrase required |

If uncertain between two levels, always classify at the higher level.

### Step 3 — Produce the Packet
Write the approval packet using the format below. Every field is required for `high` and `critical` actions. No field may be vague or omitted.

### Step 4 — Wait
Do not proceed with execution after producing the packet. The run status should be `waiting_for_approval`. The packet is staged — nothing has run.

---

## Required Output Format

```markdown
# Approval Packet: [Action Title]

> **Date:** [ISO date] · **Risk Level:** [high | critical] · **Status:** PENDING APPROVAL

---

## Proposed Action
[One clear sentence: what will happen if approved. No hedging, no ambiguity.]

## Exact Command or Payload

```[language or format]
[The literal command, API call, SQL statement, or data payload that will execute.
No paraphrasing. The exact text that will run.]
```

## Affected Resources

| Resource | Type | Change |
|---|---|---|
| [Name] | [file / record / endpoint / account] | [created / modified / deleted / sent] |

## Risk Assessment
**Level:** [high | critical]
**Justification:** [One sentence — why this action is classified at this level]
**Reversible:** [Yes — how to reverse / No — state this explicitly]
**Blast radius:** [What is the maximum scope of damage if this fails or is incorrect?]

## Expected Result
[What success looks like — specific and verifiable. How will you know it worked?]

## Rollback Plan
[Step-by-step instructions to undo this action if it produces an incorrect result]
1. [Step]
2. [Step]
3. [Step]

## Verification Steps
[How to confirm the action completed correctly after execution]
1. Check [specific location / endpoint / record] for [specific value or state]
2. [Additional verification step]

## Prerequisites
[Anything that must be true or in place before this action can safely execute]
- [ ] [Prerequisite]
- [ ] [Prerequisite]

---

**To approve:** Reply "approve" or click the approval button.
**To reject:** Reply "reject" or modify the request.
**This action will not execute until explicitly approved.**
```

---

## Quality Standards

- **The exact command must be exact.** A paraphrase of the command is not acceptable. If the user cannot copy-paste it and run it, the packet is incomplete.
- **Reversibility must be honest.** Do not claim an action is reversible unless you can provide specific rollback steps. "Just undo it" is not a rollback plan.
- **Risk level must be conservative.** When uncertain, classify higher. A false `high` results in a small delay. A missed `critical` can result in data loss, financial impact, or security breach.
- **Blast radius must be specific.** "Could affect users" is not a blast radius. "Could send a notification to all 847 subscribed users and modify their `notification_preferences` records in the production database" is.
- **Do not produce partial packets.** All fields are required for `high` and `critical` actions. A packet missing the rollback plan or verification steps is not a valid approval packet.
- **Never self-approve.** The approval packet must be presented to the user. The agent producing the packet cannot approve its own packet.
