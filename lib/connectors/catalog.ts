/**
 * Connector marketplace catalog. Each entry has an id (matches the integration
 * id when one exists), a display name, the required credential keys (read
 * from the encrypted secret store at install time), and a category for the UI.
 *
 * "Installing" a connector means: confirm secrets are present, then mark it
 * enabled in `connectors_installed`. Adapter code already exists under
 * `lib/integrations/*`; this catalog just makes installs first-class.
 */

import { getDb, saveDb, rows } from "@/lib/db/client";
import { createId, nowIso } from "@/lib/utils";
import { getSecret } from "@/lib/secrets/store";

export interface ConnectorSpec {
  id: string;
  name: string;
  category: "messaging" | "crm" | "commerce" | "finance" | "social" | "productivity" | "files" | "dev" | "research";
  description: string;
  /** Encrypted-store keys this connector reads. */
  secretKeys: string[];
  /** Best-effort: tools the model can call when this is installed. */
  tools: string[];
  docsUrl?: string;
}

export const CONNECTOR_CATALOG: ConnectorSpec[] = [
  // Built-ins that already have adapters
  { id: "instagram",  name: "Instagram",          category: "social",       description: "Read Graph API stats and recent media.",            secretKeys: ["INSTAGRAM_TOKEN", "INSTAGRAM_ACCOUNT_ID"], tools: ["instagram_stats", "instagram_recent_media", "instagram_comment_summary"] },
  { id: "tiktok",     name: "TikTok",             category: "social",       description: "Profile stats + recent videos.",                    secretKeys: ["TIKTOK_ACCESS_TOKEN"], tools: ["tiktok_stats", "tiktok_recent_videos"] },
  { id: "youtube",    name: "YouTube",            category: "social",       description: "Channel stats + latest uploads.",                   secretKeys: ["YOUTUBE_API_KEY"], tools: ["youtube_channel"] },
  { id: "stripe",     name: "Stripe",             category: "finance",      description: "Balances and recent charges.",                      secretKeys: ["STRIPE_SECRET_KEY"], tools: ["stripe_balance", "stripe_recent_charges"] },
  { id: "shopify",    name: "Shopify",            category: "commerce",     description: "Recent orders.",                                    secretKeys: ["SHOPIFY_ACCESS_TOKEN", "SHOPIFY_SHOP_DOMAIN"], tools: ["shopify_recent_orders"] },
  { id: "hubspot",    name: "HubSpot",            category: "crm",          description: "Recent contacts.",                                  secretKeys: ["HUBSPOT_API_KEY"], tools: ["hubspot_contacts"] },
  { id: "pipedrive",  name: "Pipedrive",          category: "crm",          description: "Pipedrive people directory.",                       secretKeys: ["PIPEDRIVE_API_TOKEN"], tools: ["pipedrive_persons"] },
  { id: "salesforce", name: "Salesforce",         category: "crm",          description: "Recent accounts.",                                  secretKeys: ["SALESFORCE_ACCESS_TOKEN", "SALESFORCE_INSTANCE_URL"], tools: ["salesforce_accounts"] },
  { id: "gmail",      name: "Gmail",              category: "messaging",    description: "Read recent threads; draft replies stored as approvals.", secretKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"], tools: ["gmail_inbox_recent"] },
  { id: "gcal",       name: "Google Calendar",    category: "productivity", description: "Today's agenda + conflict detection.",              secretKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"], tools: ["calendar_today"] },
  { id: "gdrive",     name: "Google Drive",       category: "files",        description: "Recent files + search.",                            secretKeys: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"], tools: ["drive_recent"] },
  { id: "firecrawl",  name: "Firecrawl",          category: "research",     description: "Scrape and crawl URLs into the vault.",             secretKeys: ["FIRECRAWL_API_KEY"], tools: ["firecrawl_scrape"] },
  { id: "github",     name: "GitHub",             category: "dev",          description: "Repos, issues, PRs.",                               secretKeys: ["GITHUB_TOKEN"], tools: ["github_repo_summary"] },
  { id: "slack",      name: "Slack",              category: "messaging",    description: "Channels, post, react.",                            secretKeys: ["SLACK_BOT_TOKEN", "SLACK_TEAM_ID"], tools: ["slack_list_channels", "slack_post_message"] },
  // Future connectors (no adapter yet, surfaced as "coming soon" in UI)
  { id: "notion",     name: "Notion",             category: "productivity", description: "Read pages, append blocks. (catalog only)",         secretKeys: ["NOTION_API_KEY"], tools: [] },
  { id: "linear",     name: "Linear",             category: "dev",          description: "Issues + cycles. (catalog only)",                   secretKeys: ["LINEAR_API_KEY"], tools: [] },
  { id: "airtable",   name: "Airtable",           category: "files",        description: "Bases and records. (catalog only)",                 secretKeys: ["AIRTABLE_API_KEY"], tools: [] },
  { id: "plaid",      name: "Plaid",              category: "finance",      description: "Bank balances + transactions. (catalog only)",      secretKeys: ["PLAID_CLIENT_ID", "PLAID_SECRET"], tools: [] },
  { id: "quickbooks", name: "QuickBooks",         category: "finance",      description: "Invoices + P&L. (catalog only)",                    secretKeys: ["QUICKBOOKS_ACCESS_TOKEN", "QUICKBOOKS_REALM_ID"], tools: [] },
  { id: "twilio",     name: "Twilio",             category: "messaging",    description: "SMS + voice. (catalog only)",                       secretKeys: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"], tools: [] },
  { id: "sendgrid",   name: "SendGrid",           category: "messaging",    description: "Outbound transactional email. (catalog only)",      secretKeys: ["SENDGRID_API_KEY"], tools: [] },
];

export interface InstalledConnector {
  id: string;
  connectorId: string;
  label?: string;
  config?: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
  missingSecrets: string[];
}

interface InstalledRow {
  id: string;
  connector_id: string;
  label: string | null;
  config_json: string | null;
  enabled: number;
  installed_at: string;
}

async function checkMissingSecrets(spec: ConnectorSpec): Promise<string[]> {
  const missing: string[] = [];
  for (const key of spec.secretKeys) {
    if (!(await getSecret(key))) missing.push(key);
  }
  return missing;
}

export async function listInstalledConnectors(): Promise<InstalledConnector[]> {
  const db = await getDb();
  const result = db.exec(`SELECT id, connector_id, label, config_json, enabled, installed_at FROM connectors_installed`);
  const items = rows<InstalledRow>(result);
  const out: InstalledConnector[] = [];
  for (const r of items) {
    const spec = CONNECTOR_CATALOG.find((c) => c.id === r.connector_id);
    out.push({
      id: r.id,
      connectorId: r.connector_id,
      label: r.label ?? undefined,
      config: r.config_json ? (JSON.parse(r.config_json) as Record<string, unknown>) : undefined,
      enabled: Boolean(r.enabled),
      installedAt: r.installed_at,
      missingSecrets: spec ? await checkMissingSecrets(spec) : [],
    });
  }
  return out;
}

export async function installConnector(connectorId: string, label?: string, config?: Record<string, unknown>): Promise<InstalledConnector> {
  const spec = CONNECTOR_CATALOG.find((c) => c.id === connectorId);
  if (!spec) throw new Error(`Unknown connector ${connectorId}`);
  const db = await getDb();
  const id = createId("conn");
  const now = nowIso();
  db.run(
    `INSERT INTO connectors_installed (id, connector_id, label, config_json, enabled, installed_at) VALUES (?, ?, ?, ?, 1, ?)`,
    [id, connectorId, label ?? null, config ? JSON.stringify(config) : null, now],
  );
  await saveDb();
  return {
    id,
    connectorId,
    label,
    config,
    enabled: true,
    installedAt: now,
    missingSecrets: await checkMissingSecrets(spec),
  };
}

export async function uninstallConnector(id: string): Promise<void> {
  const db = await getDb();
  db.run(`DELETE FROM connectors_installed WHERE id = ?`, [id]);
  await saveDb();
}

export async function toggleConnector(id: string, enabled: boolean): Promise<void> {
  const db = await getDb();
  db.run(`UPDATE connectors_installed SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
  await saveDb();
}
