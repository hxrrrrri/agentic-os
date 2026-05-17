# Codex Project Folder

This folder contains Codex-facing project playbooks for AgenticOS. The root `codex.md` file remains the Codex-specific entrypoint, and `CLAUDE.md` remains the full architecture map.

Use this folder as a lightweight local operating kit:

- `agents/` specialist stances for review, debugging, and security.
- `commands/` reusable task checklists for review, shipping, and context refresh.
- `skills/` focused task playbooks for tests, providers, and vault safety.
- `rules/` compact project constraints.
- `output-styles/` response formats.
- `hooks/` notes for future automation.

No `settings.json` is included because Codex project settings are environment-specific and this repo already has `codex.md` as the shared guidance file. Put private overrides in ignored local files only.
