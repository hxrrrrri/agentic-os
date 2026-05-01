# AgenticOS

AgenticOS is a local-first AI operating system for agentic workflows. It gives Claude Code, Codex, Ollama, OpenAI, OpenRouter, Gemini, Grok, and custom providers a shared command center with memory, runs, approvals, integrations, routines, and vault-backed artifacts.

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000/dashboard`.

Useful checks:

```bash
npm run typecheck
npm run build
```

## Storage

AgenticOS creates runtime data locally:

- `vault/` for markdown artifacts and memory files
- `.agenticos/agenticos.sqlite` for runs, logs, approvals, integrations, routines, and memory index rows

These are ignored by Git by default.

Set custom paths with:

```bash
AGENTICOS_VAULT_PATH="D:/AgenticOS/vault"
AGENTICOS_DB_PATH="D:/AgenticOS/agenticos.sqlite"
```

## Add a skill

Edit `data/seed-skills.ts` and add a `Skill` seed with:

- `id`
- `name`
- `category`
- `description`
- `template`
- `requiredIntegrations`
- `riskLevel`
- `outputLocation`
- `executionMode`

The prompt console loads the skill template and posts to `/api/runs`.

## Add an integration

Add metadata in `data/seed-integrations.ts`, then implement a real adapter beside `lib/integrations/adapters.ts`.

Current adapters are mock-first. They keep the UI and workflow engine functional without credentials.

## Add an MCP server

Register the MCP integration in `data/seed-integrations.ts`, then add an adapter that can:

1. List tools.
2. Classify each tool action by risk.
3. Route tool calls through `lib/permissions/policy.ts`.
4. Log calls through `lib/db/repositories.ts`.

MCP tool calls that mutate external systems should use approval mode.

## Permissions

Permission levels:

- `read-only`
- `draft-only`
- `approval-required`
- `auto-execute-allowed`
- `disabled`

Risky actions require approval:

- sending emails
- deleting files
- modifying production code
- pushing to GitHub
- charging or refunding payments
- changing customer data
- publishing content
- shell commands outside allowed folders
- accessing secrets
- installing dependencies
- external API writes

Approvals record the action, risk level, affected resource, exact command or payload, and approve/reject state.

## Moving from mock mode to real mode

1. Add credentials through environment variables or your OS secret manager.
2. Implement the provider or integration adapter.
3. Keep writes approval-gated until audited.
4. Add adapter-specific tests.
5. Update the integration status from `not_configured` or `partial` to `connected`.

## Architecture

- `app/` Next.js App Router pages and API routes
- `components/` dashboard, layout, charts, and UI primitives
- `lib/agent/` prompt routing, model provider registry, mock workflow engine
- `lib/db/` SQLite persistence through `sql.js`
- `lib/vault/` local vault folder creation and markdown writing
- `lib/memory/` memory index abstraction
- `lib/integrations/` mock adapter layer and real adapter extension point
- `lib/permissions/` risk and approval policy
- `data/` seeded skills, integrations, and routines
- `types/` strong TypeScript models

The workflow lifecycle is implemented as: receive goal, classify, select skill, load memory, generate plan, execute mock/tool steps, observe results, request approvals for risky paths, save artifacts, log run details, and produce a final summary.
