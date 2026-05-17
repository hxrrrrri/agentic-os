# What you do next

This audit added safe fixes, a Vitest suite, a `/tests` page, and three docs (this one, `AUDIT_REPORT.md`, `ROADMAP_FEATURES.md`).

Below is what is left for you, in order.

---

## 1. Right now (5 minutes)

- [ ] **Critical: `.gitignore` pattern `vault/` was matching every `vault/` directory in the tree.** That means `lib/vault/`, `components/vault/`, `app/vault/`, and `app/api/vault/` were **never committed**. The audit changed the pattern to `/vault/` (root-only). Now `git status` shows those source folders as untracked. Decide what to commit, then:

  ```bash
  git add lib/vault components/vault app/vault app/api/vault .gitignore
  git commit -m "track vault source dirs; scope .gitignore vault rule to repo root"
  ```

  Verify you are not committing anything in your runtime vault folder (`./vault/`) — it should still be ignored by the corrected `/vault/` rule.

- [ ] **Rotate the leaked `NVIDIA_API_KEY`** in `.env.local`. The old value was in your working tree at audit time. Mint a new one in the NVIDIA console and replace it.
- [ ] Confirm `.env.local` is in `.gitignore` (it is — just confirm `git status` shows it as ignored).
- [ ] Install Vitest:

  ```bash
  npm install
  ```

- [ ] Run the new test suite once to confirm it passes:

  ```bash
  npm test
  ```

- [ ] Open `http://localhost:3000/tests` after `npm run dev` starts. Hit **Run all tests**. Confirm the panel shows results.

---

## 2. Today (1–2 hours)

- [ ] Decide on the auth model (cookie session vs. NextAuth vs. just "trust localhost"). Until this is decided, do **not** expose the dev port over LAN/Cloudflare tunnel — every API route is unauthenticated by design.
- [ ] Set the env vars you actually want live. Minimum recommended:

  ```bash
  AGENTICOS_MODE=real
  AGENTICOS_PROVIDER=nvidia
  NVIDIA_API_KEY=...
  GITHUB_TOKEN=...
  FIRECRAWL_API_KEY=...
  YOUTUBE_API_KEY=...
  YOUTUBE_CHANNEL_ID=...
  ```

- [ ] Install the CLIs you want available in the terminal pane:

  ```bash
  npm install -g @anthropic-ai/claude-code
  npm install -g @openai/codex
  npm install -g @google/gemini-cli
  npm install -g @github/copilot
  ```

- [ ] Visit `/settings`, refresh each provider, pick a default model, and activate it.
- [ ] Visit `/command-center`, start the terminal for that provider, confirm the CLI opens.
- [ ] Run one prompt from `/dashboard`. Confirm the run completes and writes a markdown artifact to `vault/`.

---

## 3. This week

- [ ] OAuth apps for any of the integrations in Phase 1 of `ROADMAP_FEATURES.md` you intend to use (GitHub, Google, Meta, TikTok, Shopify, Stripe). Each is a 15-minute setup in the respective console.
- [ ] Decide which roadmap items are P0 for you. The cheapest wins:
  - Better-sqlite3 swap (0.5 day, ~10× perf bump on big runs)
  - Real vector memory (2 days, every run gets smarter)
  - Browser-use bridge (2 days, biggest capability jump)
- [ ] Add CI: GitHub Action that runs `npm test` and `npm run typecheck` on every push.

---

## 4. Before you let anyone else use it

- [ ] Auth (Phase 0).
- [ ] Encrypted secret storage (Phase 0).
- [ ] Backup policy for the SQLite file and vault.
- [ ] Privacy policy + terms (template will do; ship something, not nothing).
- [ ] Rate limits per session.
- [ ] Decide on a hosted DB. SQLite is fine until you have concurrent writers; once you do, swap to Postgres + Prisma or Drizzle.

---

## 5. What I did NOT do (and would need explicit go-ahead for)

- Did not swap `sql.js` → `better-sqlite3`. Requires a deps swap and you chose the low-risk option.
- Did not implement real Stripe/Shopify/Google/Instagram/TikTok adapters — needs credentials you have not shared and OAuth app setup.
- Did not write integration tests that hit the live Next dev server. The Vitest config is set up to support them (`tests/integration/` folder reserved) but each one boots a real server.
- Did not add auth middleware. Architecture decision yours.
- Did not write a marketing landing page or pricing.

---

## 6. Round-2 additions (after the first audit pass)

The follow-up turn fixed three reported issues and shipped four roadmap items.

**Bug fixes**
- `/tests` page no longer renders AppShell twice (root layout already wraps).
- Test runner no longer fails with "Unexpected end of JSON input". The `/api/tests` POST now invokes `vitest` directly via node, capping output and always returning JSON.
- Settings page now shows the **effective** mode (real vs mock), whether `AGENTICOS_MODE` / `AGENTICOS_PROVIDER` are set in env, and warns when mode is `real` but no model key is present.

**Roadmap items shipped this turn**
- Phase 1.6 — Firecrawl deep-crawl. `lib/integrations/firecrawl.ts`, `app/api/integrations/firecrawl/route.ts`, `components/command-center/firecrawl-panel.tsx`. New UI panel under Command Center → Research lets you scrape a single page or crawl a domain (up to 100 pages, depth 5), saving each page as a markdown note under `vault/raw/`. Requires `FIRECRAWL_API_KEY` (you have it).
- Phase 3 — In-app docs viewer at `/docs`. Sidebar lists `.agenticos-project/**/*.md` plus the repo-root docs (README, CLAUDE, audit reports, etc.). Click to render with `react-markdown`.
- Phase 0 — Backup script. `scripts/backup.mjs` + `npm run backup`. Copies `.agenticos/agenticos.sqlite` and the entire `vault/` into a timestamped folder under `backups/`. Optional `--keep N` flag prunes older backups. `backups/` is gitignored.
- Phase 2.5 — Push notifications for approvals. When `NTFY_TOPIC` is set, every new approval request fires a push (best-effort, swallowed on failure). Optional `NTFY_TOKEN` for private topics. The `Click` header points back at `/approvals`.

**What's still on the roadmap**
- Phase 0 — Auth middleware, better-sqlite3 swap, encrypted secret vault, durable job runner.
- Phase 1 — Real adapters for GitHub, Stripe, Google, Instagram, TikTok, YouTube Analytics.
- Phase 2 — Real vector memory, multi-agent swarm rebuild, project-context router, run theater observability, skill marketplace, billing meter, browser-use bridge, audio/video lane.
- Phase 3 — Onboarding wizard, theme picker, mobile-friendly views, Slack/Discord bot.

I did not attempt these in this turn because each is a multi-day effort that needs either credentials I don't have, a deps swap you marked low-risk, or architectural decisions only you can make. They stay in `ROADMAP_FEATURES.md`.

---

## 7. Quick reference — files added or changed

```
AUDIT_REPORT.md                                 (new)
ROADMAP_FEATURES.md                             (new)
USER_CHECKLIST.md                               (new — this file)
vitest.config.ts                                (new)
tests/README.md                                 (new)
tests/unit/permissions.test.ts                  (new)
tests/unit/skills.test.ts                       (new)
tests/unit/vault-service.test.ts                (new)
tests/unit/utils.test.ts                        (new)
tests/unit/github-trending.test.ts              (new)
tests/unit/scheduler.test.ts                    (new)
app/api/tests/route.ts                          (new)
app/api/tests/files/route.ts                    (new)
app/tests/page.tsx                              (new)
components/tests/tests-panel.tsx                (new)
next.config.ts                                  (reactStrictMode, poweredByHeader)
package.json                                    (test scripts; --webpack flag removed; vitest dep)
lib/vault/service.ts                            (hardened resolveVaultPath, truncation fix)
lib/vault/promote.ts                            (routed through resolveVaultPath)
lib/integrations/github-trending.ts             (matchAll instead of exec loop)
app/api/model-providers/[provider]/test/route.ts (Gemini key in header, not URL)
components/command-center/cc-header.tsx         (refresh button wired)
components/command-center/vault-rail.tsx        (folder/file rail now navigates)
components/command-center/research-panel.tsx   (Full / pills, refresh, chips wired)
components/command-center/weekly-review.tsx     (Full / → /runs?skill=weekly-review)
components/command-center/latest-upload.tsx     (Play opens url if provided, disabled otherwise)
components/layout/app-shell.tsx                 (Tests + Docs nav entries)

# Round 2
app/tests/page.tsx                              (drop duplicate AppShell)
app/api/tests/route.ts                          (invoke vitest via node directly)
components/tests/tests-panel.tsx                (robust non-JSON response handling)
app/settings/page.tsx                           (effective mode + env source + warnings)
lib/integrations/firecrawl.ts                   (new — scrape + crawlAndWait)
app/api/integrations/firecrawl/route.ts         (new — POST scrape/crawl, writes to vault)
components/command-center/firecrawl-panel.tsx   (new — UI under Research tab)
app/command-center/page.tsx                     (mounts FirecrawlPanel)
app/docs/page.tsx                               (new)
app/api/docs/route.ts                           (new — list)
app/api/docs/[id]/route.ts                      (new — read with whitelist)
lib/docs/sources.ts                             (new — doc index + safe reader)
components/docs/docs-viewer.tsx                 (new)
scripts/backup.mjs                              (new — npm run backup)
package.json                                    (backup script)
lib/notify/push.ts                              (new — ntfy push)
lib/agent/engine.ts                             (push on approval insert)
.gitignore                                      (backups/ added)
```

---

End of checklist.
