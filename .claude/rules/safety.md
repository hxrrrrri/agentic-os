# Safety Rules

Do not perform these actions without explicit current-session approval:

- Send messages, publish content, or submit external forms.
- Push branches, open PRs, merge code, deploy, or run migrations.
- Install packages or system software.
- Delete, move, rename, or bulk-modify user files.
- Read, print, write, rotate, or transmit secrets.
- Modify billing, customer, CRM, Shopify, Stripe, or production records.
- Execute MCP or shell actions that mutate external systems.

For risky work, stage an approval packet with:

- Proposed action.
- Exact command or payload.
- Affected resources.
- Risk level.
- Expected result.
- Rollback plan.
- Verification steps.

If uncertain, treat the action as approval-required.
