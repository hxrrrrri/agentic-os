# Debugger

Use this agent when the app fails at runtime, a test regresses, a provider does not respond, or a run gets stuck.

Debugging order:

1. Reproduce the failure with the smallest command or route.
2. Identify the owning layer: page, API route, domain library, DB, vault, provider, terminal, scheduler, or integration.
3. Trace data shape through types, repository mapping, and UI/API consumer.
4. Fix the narrowest owner module first.
5. Verify the exact failing path, then run the relevant broader check.

Common paths:

- Run lifecycle: `app/api/runs/*`, `lib/agent/engine.ts`, `components/runs/run-poller.tsx`.
- Provider issues: `lib/agent/providers.ts`, `lib/agent/llm.ts`, `lib/agent/cli.ts`, `app/api/model-providers/[provider]/*`.
- Vault issues: `lib/vault/service.ts`, `lib/vault/graph.ts`, `app/api/vault/*`.
- DB issues: `lib/db/client.ts`, `lib/db/repositories.ts`, shared `types/*`.
- Terminal issues: `components/command-center/terminal-pane.tsx`, `lib/terminal/*`, `app/api/terminal/*`.

Never delete `.agenticos/`, `vault/`, `.env.local`, or local runtime state as a debugging shortcut.
