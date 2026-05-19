/**
 * Integration registry — single source of truth for what env vars / secrets
 * each integration needs.
 *
 * The Settings page consumes this to render a toggle + fields per integration
 * and saves values into the encrypted secret store via PUT /api/secrets.
 *
 * `test` is an optional endpoint that does a live read with the supplied
 * credentials so the user knows their key actually works.
 */

export type IntegrationCategory = "model" | "research" | "content" | "social" | "business" | "dev" | "ops";

export interface IntegrationField {
  key: string; // env-var / secrets-store key
  label: string;
  type: "password" | "text" | "select";
  placeholder?: string;
  options?: string[]; // when type=select
  helpText?: string;
}

export interface IntegrationSpec {
  id: string;
  name: string;
  category: IntegrationCategory;
  description: string;
  docsUrl?: string;
  fields: IntegrationField[]; // required env vars
  optionalFields?: IntegrationField[];
  /** Endpoint to GET / POST against to verify the credentials. */
  testEndpoint?: { method: "GET" | "POST"; path: string; body?: Record<string, unknown> };
}

export const INTEGRATIONS: IntegrationSpec[] = [
  {
    id: "nvidia",
    name: "NVIDIA NIM",
    category: "model",
    description: "NVIDIA-hosted Llama, Qwen, DeepSeek, and embedding models.",
    docsUrl: "https://build.nvidia.com",
    fields: [{ key: "NVIDIA_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "nvidia", action: "test" } },
  },
  {
    id: "openai",
    name: "OpenAI",
    category: "model",
    description: "GPT models + text-embedding-3-small.",
    docsUrl: "https://platform.openai.com/api-keys",
    fields: [{ key: "OPENAI_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "openai", action: "test" } },
  },
  {
    id: "anthropic",
    name: "Anthropic",
    category: "model",
    description: "Claude models (Opus, Sonnet, Haiku).",
    docsUrl: "https://console.anthropic.com/settings/keys",
    fields: [{ key: "ANTHROPIC_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "anthropic", action: "test" } },
  },
  {
    id: "gemini",
    name: "Google Gemini",
    category: "model",
    description: "Gemini 1.5 / 2.0 models.",
    docsUrl: "https://aistudio.google.com/apikey",
    fields: [{ key: "GEMINI_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "gemini", action: "test" } },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    category: "model",
    description: "Unified gateway to dozens of model providers.",
    docsUrl: "https://openrouter.ai/keys",
    fields: [{ key: "OPENROUTER_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "openrouter", action: "test" } },
  },
  {
    id: "grok",
    name: "xAI Grok",
    category: "model",
    description: "Grok models from xAI.",
    docsUrl: "https://console.x.ai",
    fields: [{ key: "GROK_API_KEY", label: "API key", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/model-providers", body: { provider: "grok", action: "test" } },
  },
  {
    id: "groq",
    name: "Groq (Whisper)",
    category: "model",
    description: "Groq-hosted Whisper-large-v3-turbo for audio transcription.",
    docsUrl: "https://console.groq.com/keys",
    fields: [{ key: "GROQ_API_KEY", label: "API key", type: "password" }],
  },
  {
    id: "github",
    name: "GitHub",
    category: "dev",
    description: "Read PRs / issues and post comments via the approval queue.",
    docsUrl: "https://github.com/settings/tokens",
    fields: [{ key: "GITHUB_TOKEN", label: "Personal access token", type: "password" }],
    testEndpoint: { method: "POST", path: "/api/integrations/github", body: { mode: "user" } },
  },
  {
    id: "firecrawl",
    name: "Firecrawl",
    category: "research",
    description: "Web scrape, crawl, and headless browser interact.",
    docsUrl: "https://firecrawl.dev",
    fields: [{ key: "FIRECRAWL_API_KEY", label: "API key", type: "password" }],
  },
  {
    id: "youtube",
    name: "YouTube (Data API)",
    category: "content",
    description: "Public channel + video stats.",
    docsUrl: "https://console.cloud.google.com",
    fields: [
      { key: "YOUTUBE_API_KEY", label: "API key", type: "password" },
      { key: "YOUTUBE_CHANNEL_ID", label: "Channel ID", type: "text", placeholder: "UCxxxxxxxxxxxxxxxxxxxxxx" },
    ],
  },
  {
    id: "youtube-analytics",
    name: "YouTube Analytics",
    category: "content",
    description: "Audience, traffic sources, retention — OAuth required.",
    docsUrl: "https://developers.google.com/youtube/analytics",
    fields: [{ key: "YOUTUBE_ANALYTICS_TOKEN", label: "OAuth access token", type: "password" }],
  },
  {
    id: "instagram",
    name: "Instagram (Graph)",
    category: "social",
    description: "Account stats + recent media via the Meta Graph API.",
    docsUrl: "https://developers.facebook.com/docs/instagram-api",
    fields: [
      { key: "INSTAGRAM_TOKEN", label: "Access token", type: "password" },
      { key: "INSTAGRAM_ACCOUNT_ID", label: "IG business account ID", type: "text" },
    ],
  },
  {
    id: "tiktok",
    name: "TikTok",
    category: "social",
    description: "Creator stats + recent videos via TikTok Open API.",
    docsUrl: "https://developers.tiktok.com",
    fields: [{ key: "TIKTOK_TOKEN", label: "Access token", type: "password" }],
  },
  {
    id: "stripe",
    name: "Stripe",
    category: "business",
    description: "Balance, charges, subscriptions. Refunds + cancellations approval-gated.",
    docsUrl: "https://dashboard.stripe.com/apikeys",
    fields: [{ key: "STRIPE_SECRET_KEY", label: "Secret key (sk_…)", type: "password" }],
  },
  {
    id: "shopify",
    name: "Shopify",
    category: "business",
    description: "Shop, orders, products. Order cancel approval-gated.",
    docsUrl: "https://shopify.dev/docs/apps/auth/admin-app-access-tokens",
    fields: [
      { key: "SHOPIFY_SHOP_DOMAIN", label: "Shop domain", type: "text", placeholder: "mystore.myshopify.com" },
      { key: "SHOPIFY_ADMIN_TOKEN", label: "Admin API access token", type: "password" },
    ],
  },
  {
    id: "google",
    name: "Google (Gmail / Calendar / Drive)",
    category: "ops",
    description: "OAuth refresh-token flow. Powers Gmail, Calendar, Drive.",
    docsUrl: "https://console.cloud.google.com/apis/credentials",
    fields: [
      { key: "GOOGLE_CLIENT_ID", label: "OAuth client ID", type: "text" },
      { key: "GOOGLE_CLIENT_SECRET", label: "OAuth client secret", type: "password" },
      { key: "GOOGLE_REFRESH_TOKEN", label: "Refresh token", type: "password" },
    ],
  },
  {
    id: "hubspot",
    name: "HubSpot CRM",
    category: "business",
    description: "Contacts + deals via private-app access token.",
    docsUrl: "https://developers.hubspot.com/docs/api/private-apps",
    fields: [{ key: "HUBSPOT_ACCESS_TOKEN", label: "Private-app access token", type: "password" }],
  },
  {
    id: "pipedrive",
    name: "Pipedrive CRM",
    category: "business",
    description: "Persons + open deals.",
    docsUrl: "https://pipedrive.readme.io",
    fields: [{ key: "PIPEDRIVE_API_TOKEN", label: "API token", type: "password" }],
    optionalFields: [{ key: "PIPEDRIVE_DOMAIN", label: "Subdomain (default: api)", type: "text" }],
  },
  {
    id: "salesforce",
    name: "Salesforce",
    category: "business",
    description: "JWT bearer flow. Accounts + open opportunities.",
    docsUrl: "https://help.salesforce.com/s/articleView?id=sf.connected_app_create.htm",
    fields: [
      { key: "SALESFORCE_CLIENT_ID", label: "Connected App consumer key", type: "text" },
      { key: "SALESFORCE_USERNAME", label: "Integration user login", type: "text" },
      { key: "SALESFORCE_PRIVATE_KEY", label: "RSA private key (PEM)", type: "password" },
    ],
    optionalFields: [
      { key: "SALESFORCE_LOGIN_URL", label: "Login URL (default https://login.salesforce.com)", type: "text" },
    ],
  },
  {
    id: "ntfy",
    name: "ntfy push",
    category: "ops",
    description: "Phone + desktop push for approval requests.",
    docsUrl: "https://ntfy.sh",
    fields: [{ key: "NTFY_TOPIC", label: "Topic URL", type: "text", placeholder: "https://ntfy.sh/my-secret-topic" }],
    optionalFields: [{ key: "NTFY_TOKEN", label: "Bearer token (for private topics)", type: "password" }],
  },
  {
    id: "slack",
    name: "Slack webhook",
    category: "ops",
    description: "Posts run completions + approval requests to a channel.",
    docsUrl: "https://api.slack.com/messaging/webhooks",
    fields: [{ key: "SLACK_WEBHOOK_URL", label: "Incoming webhook URL", type: "password" }],
    optionalFields: [{ key: "SLACK_SIGNING_SECRET", label: "Signing secret (for /agenticos slash command)", type: "password" }],
  },
  {
    id: "discord",
    name: "Discord webhook",
    category: "ops",
    description: "Posts run completions + approval requests via a Discord webhook.",
    docsUrl: "https://discord.com/developers/docs/resources/webhook",
    fields: [{ key: "DISCORD_WEBHOOK_URL", label: "Webhook URL", type: "password" }],
  },
];

export function findSpec(id: string): IntegrationSpec | undefined {
  return INTEGRATIONS.find((s) => s.id === id);
}
