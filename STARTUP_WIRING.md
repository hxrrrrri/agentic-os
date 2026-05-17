# AgenticOS Startup Wiring

This repo is now wired to prefer real runtime data and live provider calls when credentials are present. Anything missing stays read-only or not connected instead of showing fake metrics.

## What is already wired

- Model provider tests and model catalogs: `/api/model-providers/[provider]/test` and `/models`
- Browser terminal sessions for installed CLIs: Claude Code, Codex, Gemini CLI, Copilot CLI, Ollama, Aider, Amp, Shell
- Token, cost, run, and integration metrics: `/api/metrics`
- Command center live reads for YouTube, Instagram, TikTok, Hacker News, and GitHub Trending
- Local vault artifacts and SQL.js run history
- MCP server registration endpoint: `/api/mcp`

## Required local software

Install and sign in to the CLIs you want to use:

```bash
npm install -g @anthropic-ai/claude-code
npm install -g @openai/codex
npm install -g @google/gemini-cli
npm install -g @github/copilot
```

Install Ollama separately from `https://ollama.com`, then pull at least one model:

```bash
ollama pull llama3.2
```

Optional CLIs:

```bash
pipx install aider-chat
```

## Environment variables

Copy `.env.example` to `.env.local`, then fill only the services you actually use.

Minimum recommended launch stack:

```bash
AGENTICOS_MODE=real
AGENTICOS_PROVIDER=nvidia
NVIDIA_API_KEY=...
GITHUB_TOKEN=...
FIRECRAWL_API_KEY=...
YOUTUBE_API_KEY=...
YOUTUBE_CHANNEL_ID=...
```

For social metrics:

- `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_ID`: channel stats, latest upload, weekly review.
- `INSTAGRAM_TOKEN` and `INSTAGRAM_ACCOUNT_ID`: follower and media counts through Meta Graph.
- `TIKTOK_TOKEN`: profile metrics through TikTok Open API.

For business operations:

- `STRIPE_SECRET_KEY`: revenue and subscription reads.
- `SHOPIFY_SHOP_DOMAIN` and `SHOPIFY_ADMIN_TOKEN`: order and product reads.
- `HUBSPOT_ACCESS_TOKEN` or `PIPEDRIVE_API_TOKEN` or `SALESFORCE_ACCESS_TOKEN`: CRM status.

For Google workspace:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`

Keep write actions approval-gated until each adapter has been audited.

## Startup readiness checklist

1. Run `npm install`.
2. Fill `.env.local` from `.env.example`.
3. Run `npm run typecheck` and `npm run lint`.
4. Start with `npm run dev`.
5. Open `/settings`, refresh each provider, pick a model, and activate it.
6. Open `/command-center`, start the terminal for the same provider, and confirm the CLI opens.
7. Check `/api/metrics` and confirm integrations show `connected` only for credentials you configured.
8. Run one prompt template from `/dashboard` and verify the run output shows the selected provider/model.
9. Add production auth, billing, rate limits, hosted database, logging, backups, and a secrets manager before selling access.

## Production gaps still owned by you

- OAuth app setup for Google, Meta/Instagram, TikTok, and Shopify.
- Terms, privacy policy, data retention, and customer deletion flow.
- Hosted database migration away from local SQL.js if this becomes multi-user.
- Secret storage in a managed vault instead of plain `.env.local`.
- Background job runner for scheduled routines.
- Usage-based billing enforcement and per-user rate limits.
