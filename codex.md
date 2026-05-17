# AgenticOS Codex Guide

This file is the Codex-specific entrypoint for working in this repository. It mirrors the same architecture described in `CLAUDE.md`, but adds Codex operating guidance and a condensed dependency map for fast edits.

Read `CLAUDE.md` as the canonical full project map. Keep this file in sync when changing architecture, data flow, runtime contracts, or safety policy.

## Codex Operating Rules

- Make narrow, codebase-consistent edits. This app has a small number of shared hotspots, so broad refactors can create large ripple effects.
- Do not mutate external systems without explicit approval. Writes, deletes, pushes, payments, publishing, installs, secrets, customer data, and unrestricted shell actions must remain approval-gated.
- Treat `vault/` as user memory and `.agenticos/agenticos.sqlite` as local runtime state. Do not delete or rewrite them casually.
- Treat `.env.local` as private. Do not print secrets.
- Use `npm run typecheck` as the minimum verification after TypeScript edits. Use `npm run lint` and `npm run build` for broader changes.
- Prefer existing patterns in `lib/db/repositories.ts`, `lib/agent/engine.ts`, and `lib/vault/service.ts` instead of inventing new abstractions.

## Project Snapshot

AgenticOS is a local-first AI workflow operating layer. It combines:

- Next.js App Router pages and API routes.
- React client/server components.
- SQL.js local persistence in `.agenticos/agenticos.sqlite`.
- Markdown vault storage in `vault/`.
- Seeded skills, integrations, and routines.
- Model providers across CLIs, local Ollama, and cloud APIs.
- Approval/risk policy for dangerous actions.
- Browser terminal sessions backed by PTY and SSE.
- Command-center dashboard with social, run, routine, task, research, and terminal panels.
- Portable project context in `.agenticos-project/`, injected into model prompts.

## Main Runtime Flow

```text
/dashboard
  -> PromptConsole
  -> POST /api/runs
  -> lib/agent/engine.startRun()
  -> insert run and plan into SQL.js
  -> background executeWorkflow()
  -> log steps and tool calls
  -> generate output with provider/CLI or fallback
  -> write markdown artifact to vault
  -> index artifact into memory_index
  -> update run as completed/failed/waiting_for_approval
  -> /runs/[id] streams status through /api/runs/[id]/stream
```

## Hotspot Dependency Map

### Run Engine

Owner: `lib/agent/engine.ts`

Depends on:

- `lib/skills/registry.ts`
- `lib/agent/llm.ts`
- `lib/agent/providers.ts`
- `lib/agent/swarm.ts`
- `lib/agent/project-context.ts`
- `lib/permissions/policy.ts`
- `lib/billing/pricing.ts`
- `lib/db/repositories.ts`
- `lib/memory/indexer.ts`
- `lib/vault/service.ts`

Used by:

- `app/api/runs/route.ts`
- `app/api/runs/[id]/retry/route.ts`
- `app/api/routines/route.ts`
- `lib/scheduler/worker.ts`

Changing this can affect run creation, streaming, approvals, artifact paths, cost estimates, scheduled routines, and memory indexing.

### Database

Owner: `lib/db/client.ts` and `lib/db/repositories.ts`

Tables:

- `runs`
- `run_steps`
- `tool_calls`
- `approvals`
- `memory_index`
- `integrations`
- `routines`
- `audit_logs`
- `vault_nodes`
- `vault_links`

Changing schema requires repository mapping, shared types, and UI/API updates. Existing DB files are not automatically migrated by `CREATE TABLE IF NOT EXISTS`.

### Vault

Owner: `lib/vault/service.ts`

Core functions:

- `ensureVault()`
- `resolveVaultPath()`
- `listVaultFiles()`
- `getRecentVaultFiles()`
- `loadVaultContext()`
- `writeVaultMarkdown()`
- `createDailyNote()`
- `extractWikiLinks()`

Used by the engine, vault APIs, command-center tasks, DB initialization, and memory indexing. Keep `resolveVaultPath()` strict.

### Provider Layer

Owners:

- `lib/agent/providers.ts`
- `lib/agent/llm.ts`
- `lib/agent/cli.ts`
- `components/settings/model-provider-profiles.tsx`
- `components/dashboard/prompt-console.tsx`

Shared browser storage keys:

- `agenticos.activeProvider`
- `agenticos.providerModels`
- `agenticos.providerThinking`
- `agenticos.providerEffort`

Changing provider contracts requires settings UI, prompt console, API test/model routes, pricing, and type updates.

### Terminal

Owners:

- `components/command-center/terminal-pane.tsx`
- `lib/terminal/adapters.ts`
- `lib/terminal/manager.ts`
- `app/api/terminal/*`

Terminal sessions are in-memory. Backend sends base64 chunks over SSE; frontend decodes and writes to xterm.js.

## Route Map

Pages:

- `/dashboard`: run console, metrics, integrations, activity.
- `/command-center`: operations dashboard, tasks, research, terminal.
- `/vault`: vault browser, notes, graph, conflicts, promotions, patterns.
- `/runs`: run ledger.
- `/runs/[id]`: run detail and final output.
- `/skills`: skill registry.
- `/integrations`: integration permissions and status.
- `/routines`: schedule and routine actions.
- `/approvals`: approval inbox.
- `/settings`: runtime paths, providers, budgets, project context manifest.

APIs:

- `/api/runs`, `/api/runs/[id]`, `/api/runs/[id]/stream`, `/api/runs/[id]/retry`
- `/api/metrics`
- `/api/skills`
- `/api/routines`
- `/api/approvals`
- `/api/scheduler`
- `/api/model-providers/[provider]/test`
- `/api/model-providers/[provider]/models`
- `/api/terminal/*`
- `/api/command-center/tasks`
- `/api/vault/*`
- `/api/mcp`

## Safe Edit Checklist

Before editing:

1. Find the owner module for the behavior.
2. Search for imports/usages of exported functions or shared types.
3. Check whether the change crosses page, API, lib, DB, and component boundaries.
4. For persistence changes, update schema, repository mapping, and types together.
5. For provider changes, update registry, dispatch, UI, API checks, and pricing together.
6. For vault changes, preserve path safety and avoid rewriting user notes unless requested.
7. For approval/risk changes, keep dangerous actions blocked by default.

After editing:

```bash
npm run typecheck
```

Use these for broader source changes:

```bash
npm run lint
npm run build
```

## Common Change Recipes

### Add a Skill

- Edit `data/seed-skills.ts`.
- Ensure routine references use the new skill id only if it exists.
- If category changes are needed, update `types/skill.ts`, `categoryOutput`, `describe()`, `classifyPrompt()`, and UI displays.

### Add a Model Provider

- Edit `types/agent.ts`.
- Add registry entry in `lib/agent/providers.ts`.
- Add generation path in `lib/agent/llm.ts`.
- Add test/model support in `app/api/model-providers/[provider]/*`.
- Update `components/settings/model-provider-profiles.tsx`.
- Add pricing in `lib/billing/pricing.ts`.

### Add a DB Field

- Update `lib/db/client.ts`.
- Update `lib/db/repositories.ts`.
- Update `types/*`.
- Update all UI/API consumers.
- Add migration logic if existing local DBs matter.

### Add Vault Behavior

- Use `resolveVaultPath()` for all user paths.
- Write through `writeVaultMarkdown()` where possible.
- Reindex graph if paths or wikilinks change.
- Update `/vault` UI and `/api/vault/*` route together.

## Known Limitations

- No dedicated test suite currently exists.
- Existing SQL.js DBs do not get automatic ALTER migrations.
- Approval resolution does not resume blocked workflows.
- Most integration adapters are mock-first.
- Terminal and MCP sessions are memory-only.
- Some strings contain mojibake from prior encoding issues; avoid adding more.

## Canonical Deep Reference

Use `CLAUDE.md` for the complete architecture, file map, data flows, dependency explanations, and manual smoke-test matrix.
