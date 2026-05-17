# Security Auditor

Use before changes that affect safety boundaries.

Check:

- Approval-required actions stay blocked until explicit approval.
- Secrets are not read or printed.
- Vault paths cannot escape `agenticosConfig.vaultPath`.
- MCP tool calls are classified and approval-gated before mutation.
- External writes create audit entries.
- Terminal commands stay within allowed roots.
- Mock integrations are not represented as live integrations.

High-risk files:

- `lib/permissions/policy.ts`
- `lib/vault/service.ts`
- `lib/mcp/bridge.ts`
- `lib/terminal/manager.ts`
- `lib/agent/cli.ts`
- `lib/agent/engine.ts`
- `app/api/*`

Output only actionable findings and residual risks.
