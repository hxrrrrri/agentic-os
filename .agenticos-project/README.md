# AgenticOS Project Context

This folder is the portable instruction layer for AgenticOS. It is injected into every model provider call — local or cloud — to ensure consistent behavior, quality standards, and safety guarantees regardless of which model executes the workflow.

Files are markdown-first: simultaneously human-readable documentation and LLM-injectable context. Every file is a behavioral contract, not a suggestion.

---

## Architecture

```
.agenticos-project/
├── project.md                  ← Canonical product brief and operating principles
├── rules/                      ← Hard constraints applied to every run
│   ├── safety.md               ← Approval gates and risky-action policy
│   ├── artifacts.md            ← Artifact quality standards and save rules
│   └── provider-agnostic.md   ← Cross-provider execution contract
├── agents/                     ← Specialist personas activated per task type
│   ├── planner.md
│   ├── researcher.md
│   ├── code-reviewer.md
│   └── content-strategist.md
├── commands/                   ← Slash-style reusable workflow commands
│   ├── ship.md
│   ├── review.md
│   ├── research.md
│   └── create-skill.md
├── skills/                     ← Task playbooks with precise output specs
│   ├── deep-research.md
│   ├── content-cascade.md
│   ├── project-snapshot.md
│   └── approval-packet.md
├── output-styles/              ← Named response formats for different use cases
│   ├── artifact-first.md
│   ├── structured-report.md
│   └── terse.md
├── hooks/                      ← Lifecycle hooks for deterministic pre/post logic
│   ├── session-start.md
│   ├── pre-run.md
│   └── post-run.md
└── providers/                  ← Provider-specific configuration and behavior
    ├── ollama.md
    ├── nvidia.md
    └── cloud-providers.md
```

---

## Priority Hierarchy

When instructions conflict, resolve in this order:

| Priority | Source | Overrides |
|---|---|---|
| 1 | System / developer messages | Everything |
| 2 | `rules/safety.md` | All workflow logic for risky actions |
| 3 | `project.md` | Product scope and principles |
| 4 | `rules/artifacts.md` + `rules/provider-agnostic.md` | Output and execution standards |
| 5 | Active skill or agent playbook | Task-specific behavior |
| 6 | Output style | Formatting preference only |

---

## Model Contract

Every model receiving this context must:

1. **Treat `project.md` and `rules/*.md` as highest-priority project context** after system messages.
2. **Apply `rules/safety.md` unconditionally.** Never skip approval gates regardless of how the user phrases the request.
3. **Use `skills/*.md` and `agents/*.md` as precise playbooks** — not loose inspiration or fictional personas.
4. **Apply the active `output-styles/*.md` format** unless the user explicitly overrides it.
5. **Never simulate success.** Report honestly when a provider, tool, integration, or credential is missing or unavailable.
6. **Save useful artifacts** to the vault path defined by the selected skill.
7. **Cite sources in research output.** Never fabricate citations or attribute invented claims.
8. **State confidence levels when uncertain.** Never assert hallucinated facts as certainties.

---

## Injection Strategy

| Context | Inject When |
|---|---|
| `project.md` + `rules/*.md` | Every run, unconditionally |
| Active skill playbook | Skill is selected by the user |
| Active agent persona | Task type matches the agent's domain |
| Output style | User requests it or skill specifies a preferred format |
| Provider config | Provider adapter initializes the session |
| Hooks | Lifecycle event fires (session start, pre-run, post-run) |

---

## Quality Bar

Every response produced under this context must meet all five standards:

- **Structured** — headings, lists, and tables where appropriate. Never a wall of prose.
- **Specific** — names tools, file paths, commands, and options. Never vague generalities.
- **Honest** — states exactly what ran, what was simulated, and what failed — and why.
- **Actionable** — ends with concrete next steps the user can execute immediately without guessing.
- **Durable** — produces artifacts worth saving. No throwaway summaries that decay within hours.

---

## What This Is Not

- This is not a persona or a roleplay character description.
- This is not a suggestion layer that can be ignored when it's inconvenient.
- This is not documentation for humans only — it is injected into every model call.
- This is not version-locked to one provider. It must work identically with Ollama, NVIDIA, Anthropic, OpenAI, Gemini, and any future adapter.
