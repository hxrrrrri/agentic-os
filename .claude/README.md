# Claude Project Folder

This folder contains Claude-facing project playbooks for AgenticOS. The root `CLAUDE.md` remains the primary Claude entrypoint, and `.agenticos-project/` remains the canonical provider-agnostic context that the app injects into model runs.

Use this folder for Claude Code conveniences that map the project context into Claude-native concepts:

- `agents/` specialist review, debugging, and security playbooks.
- `commands/` slash-command style workflows for common local tasks.
- `skills/` model-invokable task playbooks for AgenticOS work.
- `rules/` compact project rules that should be checked before edits.
- `output-styles/` response formats for concise or artifact-first output.
- `hooks/` hook notes and templates. Hooks are intentionally not registered in `settings.json` yet.

Not included:

- `plugins/` because this repo does not currently need a Claude plugin.
- `.mcp.json` because no concrete MCP server is required by the current project setup.
- local override files because those should be personal and ignored, not shared.
