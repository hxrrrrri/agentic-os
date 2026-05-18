/**
 * Curated catalog of MCP servers we know how to install.
 *
 * Two flavors:
 *  - third-party packages (run via `npx -y <package>` or `uvx <package>`)
 *  - the AgenticOS local server (id: "agenticos") that exposes every direct
 *    adapter as a tool. This is what lets CLI providers reach Instagram /
 *    TikTok / YouTube / Stripe / Shopify even though no first-party MCP for
 *    them exists.
 *
 * Each spec lists which credential keys it consumes — when an entry is
 * installed, the configurator pulls those values from the encrypted secret
 * store and writes them into the env block of the MCP server config.
 */

export type McpRuntime = "npx" | "uvx" | "node-local";

export interface McpServerSpec {
  id: string;
  name: string;
  description: string;
  category: "dev" | "search" | "browser" | "ops" | "data" | "agenticos";
  runtime: McpRuntime;
  /** Command that boots the server (e.g. "@modelcontextprotocol/server-github"). */
  package: string;
  /** Static args appended after the package name (e.g. allow-list of fs paths). */
  args?: string[];
  /** Credential keys (from our secrets store) → env-var name passed to the MCP server. */
  envMap?: Record<string, string>;
  /** Optional default env vars (non-secret). */
  staticEnv?: Record<string, string>;
  docsUrl?: string;
  /** Tools the server exposes (for UI display only). */
  exposes: string[];
}

export const MCP_CATALOG: McpServerSpec[] = [
  {
    id: "agenticos",
    name: "AgenticOS (local)",
    description:
      "Exposes every AgenticOS direct adapter as MCP tools — Instagram, TikTok, YouTube, Stripe reads, Shopify, HubSpot, Pipedrive, Salesforce, Calendar, Drive, Firecrawl, billing meter, vault.",
    category: "agenticos",
    runtime: "node-local",
    package: "scripts/mcp-server.mjs",
    exposes: [
      "instagram.stats",
      "instagram.recent_media",
      "instagram.comment_summary",
      "tiktok.stats",
      "tiktok.recent_videos",
      "youtube.channel",
      "youtube.weekly_review",
      "stripe.balance",
      "stripe.charges",
      "shopify.orders",
      "hubspot.contacts",
      "pipedrive.persons",
      "salesforce.accounts",
      "calendar.today",
      "drive.recent",
      "firecrawl.scrape",
      "vault.write_note",
      "vault.search",
      "billing.today",
    ],
  },
  {
    id: "github",
    name: "GitHub",
    description: "Official GitHub MCP server — repos, issues, PRs, files, code search.",
    category: "dev",
    runtime: "npx",
    package: "@modelcontextprotocol/server-github",
    envMap: { GITHUB_TOKEN: "GITHUB_PERSONAL_ACCESS_TOKEN" },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
    exposes: ["create_issue", "list_issues", "get_pull_request", "search_repositories", "get_file_contents", "create_or_update_file"],
  },
  {
    id: "filesystem",
    name: "Filesystem",
    description: "Sandboxed file read/write under an allow-list of root directories.",
    category: "data",
    runtime: "npx",
    package: "@modelcontextprotocol/server-filesystem",
    // The repo root and vault path are passed as positional args.
    args: ["__VAULT_PATH__", "__REPO_ROOT__"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
    exposes: ["read_file", "write_file", "list_directory", "search_files", "move_file"],
  },
  {
    id: "postgres",
    name: "Postgres",
    description: "Read-only SQL queries against a Postgres database.",
    category: "data",
    runtime: "npx",
    package: "@modelcontextprotocol/server-postgres",
    args: ["__DATABASE_URL__"],
    envMap: { DATABASE_URL: "POSTGRES_URL" },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
    exposes: ["query"],
  },
  {
    id: "sqlite",
    name: "SQLite",
    description: "Read/write against a SQLite file. Points at the AgenticOS DB by default.",
    category: "data",
    runtime: "uvx",
    package: "mcp-server-sqlite",
    args: ["--db-path", "__DB_PATH__"],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
    exposes: ["read_query", "write_query", "list_tables", "describe_table"],
  },
  {
    id: "brave-search",
    name: "Brave Search",
    description: "Web + local search via Brave Search API.",
    category: "search",
    runtime: "npx",
    package: "@modelcontextprotocol/server-brave-search",
    envMap: { BRAVE_API_KEY: "BRAVE_API_KEY" },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/brave-search",
    exposes: ["brave_web_search", "brave_local_search"],
  },
  {
    id: "fetch",
    name: "Fetch",
    description: "Fetch + Markdown-convert any URL. No auth required.",
    category: "search",
    runtime: "uvx",
    package: "mcp-server-fetch",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
    exposes: ["fetch"],
  },
  {
    id: "memory",
    name: "Memory (knowledge graph)",
    description: "Persistent entity / relation memory across sessions.",
    category: "data",
    runtime: "npx",
    package: "@modelcontextprotocol/server-memory",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
    exposes: ["create_entities", "search_nodes", "open_nodes"],
  },
  {
    id: "sequential-thinking",
    name: "Sequential Thinking",
    description: "Structured chain-of-thought scratchpad with branching.",
    category: "agenticos",
    runtime: "npx",
    package: "@modelcontextprotocol/server-sequential-thinking",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
    exposes: ["sequentialthinking"],
  },
  {
    id: "puppeteer",
    name: "Puppeteer Browser",
    description: "Headless Chromium via Puppeteer. Click / type / screenshot / evaluate.",
    category: "browser",
    runtime: "npx",
    package: "@modelcontextprotocol/server-puppeteer",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
    exposes: ["puppeteer_navigate", "puppeteer_screenshot", "puppeteer_click", "puppeteer_fill", "puppeteer_evaluate"],
  },
  {
    id: "slack",
    name: "Slack",
    description: "Read channels, post messages, list users.",
    category: "ops",
    runtime: "npx",
    package: "@modelcontextprotocol/server-slack",
    envMap: { SLACK_BOT_TOKEN: "SLACK_BOT_TOKEN", SLACK_TEAM_ID: "SLACK_TEAM_ID" },
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
    exposes: ["slack_list_channels", "slack_post_message", "slack_reply_to_thread", "slack_get_users"],
  },
  {
    id: "gdrive",
    name: "Google Drive",
    description: "Read + search files in your Drive (OAuth flow runs once on first use).",
    category: "ops",
    runtime: "npx",
    package: "@modelcontextprotocol/server-gdrive",
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
    exposes: ["search", "read_file"],
  },
];

export function findMcpSpec(id: string): McpServerSpec | undefined {
  return MCP_CATALOG.find((s) => s.id === id);
}
