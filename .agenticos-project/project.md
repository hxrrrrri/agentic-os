# AgenticOS — Canonical Project Brief

AgenticOS is a local-first AI operating system for agentic workflows. It coordinates multiple LLM providers, local tools, memory, approval gates, integrations, routines, and vault-backed artifacts through a single controlled command center — with a clear audit trail for every action.

---

## The Problem It Solves

Modern AI workflows are fragmented. Model selection, prompt templates, tool calls, memory, approvals, and saved artifacts live in separate disconnected surfaces. Context is lost between sessions. Risky actions happen without review. Outputs evaporate with no durable record.

AgenticOS makes these pieces work together: one workspace, one audit trail, one approval layer, one memory vault. The model changes; the operating principles do not.

---

## Core Capabilities

| Capability | Description |
|---|---|
| Provider profiles | Switch between local (Ollama) and cloud (NVIDIA, OpenAI, Anthropic, Gemini, Grok) models without rebuilding prompts |
| Skill templates | Reusable workflow playbooks that define the task, steps, risk level, and output location |
| Run lifecycle | Planning → execution → tool calls → observations → final artifact |
| Vault storage | Markdown outputs saved locally by category (`/vault/wiki`, `/vault/content`, `/vault/daily`, etc.) |
| Run history | SQLite-backed log of every run with status, steps, tool calls, and final output |
| Approval gates | Explicit user confirmation required before any risky external action |
| Integration adapters | MCP servers, REST APIs, CLIs, and SaaS connectors behind a permission layer |
| Project context | This folder — portable instruction context injected into every model call |
| Memory indexing | Generated artifacts indexed for retrieval in future runs |

---

## Operating Principles

These are non-negotiable. They apply to every run, every model, every skill.

### 1. Local-First by Default
All computation happens locally unless a cloud provider is explicitly selected. Private data stays on device. No silent cloud calls.

### 2. Real Output Over Simulation
When a provider adapter is configured and credentials are present, produce real output. Mock fallback is only acceptable when an adapter, credential, or local service is verifiably absent.

### 3. Approval Before External Action
No run may send, post, delete, deploy, install, charge, or modify external systems without explicit user approval in the current session. Drafts are not the same as execution. Staged commands are not the same as sent commands.

### 4. Honest Failure Reporting
If a model call fails, report the exact error. If an integration is unavailable, say so. If output is simulated, label it as simulated. Never claim success for something that did not happen.

### 5. Durable Artifacts Over Transient Summaries
Every useful result becomes a markdown artifact in the vault. Transient in-memory summaries that cannot be retrieved later are not acceptable as final output for research, content, or planning tasks.

### 6. Audit Trail Always
Every tool call, approval event, run step, and artifact write is logged. The audit log is immutable during a session.

---

## Product Boundaries

AgenticOS does **not**:
- Execute shell commands without explicit user approval and risk acknowledgment.
- Send or publish content without staging and approval.
- Store secrets in vault files, run outputs, logs, or artifacts.
- Bypass approval gates because a workflow step suggests it.
- Pretend a model or integration ran when it did not.

---

## Current Development Priority

Make AgenticOS feel like a real agent workspace, not a hardcoded demo. Specifically:

1. Provider selection should visibly change the quality and depth of run output.
2. Project context (this folder) should actively shape model behavior on every run.
3. Skills, agents, and output styles should produce meaningfully different results — not cosmetically different ones.
4. The approval layer should be frictionless for low-risk actions and genuinely protective for high-risk ones.
5. The vault should grow into a useful knowledge base, not a graveyard of generic summaries.

---

## Vocabulary

| Term | Definition |
|---|---|
| **Run** | A single end-to-end execution of a prompt through the agent engine |
| **Skill** | A named workflow playbook with a template, category, risk level, and output location |
| **Agent** | A specialist persona that shapes how a model approaches a task category |
| **Vault** | The local markdown file store where artifacts are persisted |
| **Provider** | A model endpoint (local or cloud) used to generate output |
| **Approval gate** | A mandatory user confirmation step before a risky action executes |
| **Artifact** | A durable vault file produced as the final output of a run |
| **Memory** | Indexed vault content available as context in future runs |
