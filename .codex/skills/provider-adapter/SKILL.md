---
name: provider-adapter
description: Use when changing provider registry, model dispatch, CLI providers, provider tests, or provider settings UI.
---

# Provider Adapter

Relevant files:

- `types/agent.ts`
- `lib/agent/providers.ts`
- `lib/agent/llm.ts`
- `lib/agent/cli.ts`
- `lib/billing/pricing.ts`
- `app/api/model-providers/[provider]/test/route.ts`
- `app/api/model-providers/[provider]/models/route.ts`
- `components/settings/model-provider-profiles.tsx`
- `components/dashboard/prompt-console.tsx`

Rules:

- Preserve provider ids and browser storage keys.
- Keep cloud usage explicit.
- Never expose API keys.
- Report provider failures honestly.
- Update pricing, UI, route tests, and type definitions together when contracts change.

Verify with `npm run typecheck` and targeted runtime checks when possible.
