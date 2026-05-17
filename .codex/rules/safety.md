# Safety Rules

Approval is required before:

- External writes.
- Pushes, PRs, merges, deploys, migrations, installs.
- File deletion, bulk movement, or destructive cleanup.
- Secret access or secret printing.
- Billing, production, customer, CRM, Stripe, Shopify, or social publishing mutations.
- Risky MCP or shell tool execution.

For risky actions, provide:

- Proposed action.
- Exact command or payload.
- Affected resources.
- Risk level.
- Rollback plan.
- Verification steps.

When in doubt, stop and ask for approval.
