---
name: provider-adapter
description: Use when adding, fixing, or reviewing a model provider, CLI provider, or provider settings flow.
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

- Keep provider ids stable.
- Keep localStorage keys compatible between settings and prompt console.
- Report real provider errors honestly.
- Never print API keys.
- Keep cloud calls explicit and configurable.
- Add pricing only when the model id and unit are known.

Verification:

```bash
npm run typecheck
npm run lint
```
