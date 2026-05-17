# AgenticOS — High-Value Roadmap

Where to go next. Each item rated by value × effort. Ordered by recommended sequence.

---

## Phase 0 — Production-safety (must do before any external use)

| Item | Why | Effort |
| --- | --- | --- |
| Auth middleware (cookie session or NextAuth) | Right now every API route is reachable by anyone who can reach the port. Localhost is fine; LAN/tunnel is not. | 1 day |
| Better-sqlite3 swap | Removes `fs.writeFileSync` per insert. ~10–50× DB throughput. | 0.5 day |
| Encrypted secret vault (`age` or OS keychain) for keys | `.env.local` plaintext is fine for one machine; not fine for multi-user. | 1 day |
| Background job runner that survives restart (BullMQ + Redis or pg-boss) | Current scheduler dies with the process. Routines are not durable. | 1 day |
| Backups + retention policy for `.agenticos/agenticos.sqlite` and vault | Today there is no backup. One disk crash = total loss. | 0.5 day |

---

## Phase 1 — Real-data adapters (replace mocks)

Pick the ones you actually need. Each one is its own card; do not boil the ocean.

### 1.1 GitHub (read + write)
- Reads: PRs, issues, releases, traffic, deployment status.
- Writes (approval-gated): comment on PR, create issue, dispatch workflow.
- Effort: 1–2 days.

### 1.2 YouTube Analytics (full)
- Currently: channel reads only. Add Analytics API for retention curves, audience demographics, traffic sources, revenue.
- Real `audience-panel.tsx` once this lands.
- Effort: 1 day (requires `YOUTUBE_ANALYTICS_TOKEN`).

### 1.3 Stripe
- Reads: MRR, ARR, recent invoices, failed charges.
- Writes (approval-gated): refund, subscription cancel, customer update.
- Effort: 1–2 days.

### 1.4 Gmail / Calendar / Drive
- OAuth installed app flow.
- Inbox triage, calendar conflict detection, doc auto-filing.
- Effort: 2–3 days.

### 1.5 Instagram + TikTok
- Meta Graph + TikTok Open API.
- Follower trend, post performance.
- Effort: 1 day each. Watch their token expiry — both rotate every ~60 days.

### 1.6 Firecrawl deep crawl skill
- You have the key. Build a "research a topic" skill that maps a domain, crawls top 50 pages, summarizes, drops markdown into `vault/raw/`.
- Effort: 0.5 day.

---

## Phase 2 — Capabilities that compound (the actual differentiation)

These are what move AgenticOS from "a wrapper around Claude" to a defensible product.

### 2.1 Vector memory + semantic search
- Replace `lib/memory/indexer.ts` placeholder with real embeddings (Nvidia nv-embedqa-1b-v2 or OpenAI text-embedding-3-small).
- Store vectors in `sqlite-vec` (best-sqlite3 + sqlite-vec extension) — no separate DB.
- Hybrid search (BM25 + vector) for the recall step in every workflow.
- Effort: 2 days. Value: every run becomes "informed by everything you've ever written".

### 2.2 Multi-agent swarm (productionized)
- `lib/agent/swarm.ts` exists as a stub. Expand to:
  - Planner → Researcher → Writer → Critic → Editor pipeline.
  - Each agent sees the prior's output. Critic can send back for revision.
  - Token + cost budget per agent, halt if exceeded.
- Effort: 3–5 days. Value: produces materially better content than a single-shot call.

### 2.3 Project context router
- Right now every run loads the same `.agenticos-project/` context. Detect which project the prompt is about (vault folder, repo, calendar event) and load only the relevant rules/agents/skills.
- Effort: 2 days.

### 2.4 Live workflow observability
- Replace polling SSE with an in-memory event bus. Stream every plan step, tool call, approval into a live "Run Theater" page.
- Effort: 2 days. Value: the surface that sells the product.

### 2.5 Approval queue with mobile push
- ntfy / Pushover / Slack DM when an approval is pending.
- Approve/reject from the notification.
- Effort: 1 day.

### 2.6 Skill marketplace (local-first)
- Each skill is a folder with `manifest.json`, `template.md`, optional `pre.ts` / `post.ts` hooks.
- Drop a skill folder into `data/skills/` → it appears in the prompt console.
- Public registry that ships installs as git submodules. No payment yet.
- Effort: 3 days.

### 2.7 Billing meter
- Already have pricing in `lib/billing/pricing.ts`. Plumb it everywhere: per-run, per-skill, per-day, per-user.
- Soft cap → email warning. Hard cap → require approval. Per-project budgets.
- Effort: 2 days.

### 2.8 Browser-use / Computer-use bridge
- Wrap [browser-use](https://github.com/browser-use/browser-use) or [Anthropic computer-use](https://docs.anthropic.com/en/docs/agents-and-tools/computer-use) as a skill. Now AgenticOS can drive a browser, fill forms, screenshot results — for free with Claude.
- Effort: 2 days. Value: huge — eats every "automate this site" use case.

### 2.9 Audio / video lane
- ffmpeg + Whisper.cpp local transcription.
- "Transcribe this meeting note" → vault.
- Effort: 2 days.

### 2.10 Distributed run engine (eventually)
- When usage grows, peel `lib/agent/engine.ts` into a sidecar (Rust or Bun) with the same DB schema. Frontend stays Next.js.
- Out of scope for one solo user; on the map for SaaS.

---

## Phase 3 — Surface polish that closes deals

| Item | Why | Effort |
| --- | --- | --- |
| Onboarding wizard at first launch | Walk new user through .env, OAuth, model pick, first run. | 1 day |
| In-app docs viewer (renders `.agenticos-project/` skill/rule markdown) | Self-documenting. No external docs site needed. | 0.5 day |
| Theme picker (light + dark + high-contrast) | Currently fixed dark. | 0.5 day |
| Mobile-friendly approval and run views | Lets you approve from phone. | 1 day |
| Slack/Discord bot wrapper | "Run morning brief" from Slack. | 1 day |

---

## How to value this

A solo product:
- Phase 0 + Phase 1.6 + Phase 2.1 + Phase 2.5 + Phase 2.8 = a personal AI OS that nobody else has. ~2 weeks of focused work.
- Add Phase 2.2 + 2.3 + 2.4 = a defensible SaaS product. ~6–8 weeks.
- Phase 2.6 + 2.7 = monetization surface. Another 1–2 weeks.

Realistic target: $50–500 / month per seat for a curated audience of solo founders, researchers, and indie ops people. The path to "millions" is paid seats × niche outreach × the multi-agent quality differentiator, not new features.

---
