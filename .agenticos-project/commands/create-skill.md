# Command: /create-skill

Use this command when the user wants to define a new reusable AgenticOS skill. A skill is a named, categorized workflow playbook that can be triggered from the dashboard, loaded as a prompt template, and executed consistently across model providers.

A well-built skill is specific enough that a model receiving only the skill template — with no additional context — produces correct, useful output on the first try.

---

## When to Use

- The user wants to automate a recurring task they perform manually.
- The user has a prompt template they want to save and share.
- A workflow involves multiple steps, tools, or integrations that need to be documented.
- A task is domain-specific enough that a generic prompt reliably produces mediocre output.

---

## Workflow

### Step 1 — Understand the Task
Before writing any spec, answer:
- What is this skill used for? What task does it automate or assist?
- Who runs this skill and when? What triggers it?
- What does a successful output look like? Can you describe a specific example?
- What tools, APIs, or integrations does it need? Which are optional vs. required?
- What could go wrong? What are the failure modes?

If any of these are unclear, ask before proceeding.

### Step 2 — Classify the Skill

| Field | Options | Notes |
|---|---|---|
| **Category** | `memory` / `productivity` / `research` / `content` / `dev` / `business` / `custom` | Choose the best fit |
| **Risk level** | `low` / `medium` / `high` / `critical` | Conservative: if unsure, go higher |
| **Execution mode** | `dry-run` / `approval` / `auto` | `approval` for any external writes |
| **Output location** | `/vault/wiki` / `/vault/content` / `/vault/daily` / `/vault/projects` / `/vault/memory` / `/vault/runs` | Match the category default or specify |

### Step 3 — Write the Template
The template is the most important part. It must be:
- **Complete:** The model should not need to ask what to do next.
- **Ordered:** Steps should be numbered and sequential where order matters.
- **Specific:** Name the format, length, quality bar, and save location.
- **Safe:** Include any required approval gates or dry-run caveats in the template itself.

Template quality test: hand the template to any capable LLM with no additional context. If it produces a useful, correct output — the template is good. If it asks what to do or produces something generic — revise it.

### Step 4 — Define the Spec

```markdown
## Skill Spec: [Skill Name]

**ID:** [kebab-case-id]
**Name:** [Display name]
**Category:** [category]
**Risk level:** [low | medium | high | critical]
**Execution mode:** [dry-run | approval | auto]
**Output location:** [vault path]

### Required Integrations
[List each integration by name. Mark as (required) or (optional).]
- [integration-name] — (required | optional) — [what it's used for]

### Description
[One sentence. What does this skill do and when should a user reach for it?]

### Template
[The full template prompt that will be loaded when this skill is selected]

### Trigger Terms
[Keywords or phrases that should auto-suggest this skill when typed in the prompt console]

### Expected Output
[What a successful run produces. Format, length, vault path, and key quality signals.]

### Sample Input → Output
**Input:** [Example prompt the user might type]
**Output:** [Description of what the model should produce]

### Failure Modes
[What can go wrong, and what should the model do in each case]
| Failure | Expected behavior |
|---|---|
| Integration unavailable | [How to handle] |
| Model returns empty output | [How to handle] |
| Credentials missing | [How to handle] |
```

### Step 5 — Output the Registration Change
Return the exact change needed in `data/seed-skills.ts` to register this skill:

```typescript
// Add to the seeds array in data/seed-skills.ts
{ id: "[id]", name: "[Name]", category: "[category]", integrations: ["[integration]"], risk: "[level]", mode: "[mode]", output: "[path]" },

// Add to the templates object in data/seed-skills.ts
"[id]": "[full template text]",
```

---

## Quality Standards

- **One skill, one purpose.** If a skill tries to do three different things, split it into three skills.
- **Template must be self-contained.** A model receiving only the template and the user's topic input should produce correct output. Do not rely on context that is not in the template.
- **Risk must be conservative.** A skill that sends email is `high` risk even if it asks for approval in the template. The risk level controls the approval gate behavior — it is not just a label.
- **Test the template before registering.** Copy the template, fill in a sample topic, and run it through a capable model. If the output is generic or the model asks clarifying questions, the template needs revision.
- **Document failure modes.** A skill without documented failure modes will silently produce confusing output when an integration is unavailable. Specify the fallback behavior explicitly.
