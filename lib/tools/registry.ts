import type { ToolDefinition } from "@/types";

/** Canonical tool registry. Adding a tool here makes it visible to the
 *  tool-use loop. The dispatcher imports this and routes by name. */
export const toolRegistry: ToolDefinition[] = [
  {
    name: "render_carousel",
    description:
      "Render a multi-slide social carousel as SVG slides + an HTML preview index. Use for Instagram/LinkedIn carousels. Provide a title and an array of slides (each with title/body).",
    group: "artifact",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Carousel title" },
        slides: {
          type: "array",
          description: "Ordered slide specs (3-10 recommended)",
          items: {
            type: "object",
            properties: {
              title: { type: "string" },
              body: { type: "string" },
              footer: { type: "string" },
            },
          },
        },
        aspect: {
          type: "string",
          enum: ["1:1", "4:5", "9:16", "16:9"],
          description: "Aspect ratio. Default 1:1.",
        },
        variantGroup: {
          type: "string",
          description: "Optional label (e.g. v1, v2) for grouping multiple variants of the same brief.",
        },
      },
      required: ["title", "slides"],
    },
  },
  {
    name: "render_thumbnail",
    description:
      "Render a hero thumbnail SVG. Use for YouTube thumbnails, blog hero images, post headers. Provide title + optional subtitle/badge.",
    group: "artifact",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        badge: { type: "string" },
        aspect: { type: "string", enum: ["16:9", "1:1", "9:16"] },
        variantGroup: { type: "string" },
      },
      required: ["title"],
    },
  },
  {
    name: "generate_image",
    description:
      "Generate a photo-realistic or illustrated image via an AI image model (OpenAI / Gemini / Stability). Use for hero imagery, product mockups, ad creatives. Requires API key.",
    group: "artifact",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        prompt: { type: "string", description: "Detailed image prompt" },
        title: { type: "string", description: "Artifact title" },
        size: { type: "string", description: "1024x1024 / 1792x1024 / 1024x1792" },
        provider: { type: "string", enum: ["openai", "gemini", "stability"] },
        quality: { type: "string", enum: ["low", "standard", "high"] },
        variantGroup: { type: "string" },
      },
      required: ["prompt", "title"],
    },
  },
  {
    name: "gmail_search",
    description:
      "Search Gmail using Gmail query syntax. Examples: 'is:unread newer_than:1d', 'from:invoices@'. Returns headers + snippet + body text. READ-ONLY.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Gmail query string" },
        maxResults: { type: "number" },
      },
      required: ["query"],
    },
  },
  {
    name: "gmail_create_draft",
    description:
      "Create a draft email in Gmail. APPROVAL-GATED. Used to stage replies for the user to send.",
    group: "integration",
    riskLevel: "high",
    requiresApproval: true,
    inputSchema: {
      type: "object",
      properties: {
        to: { type: "string" },
        subject: { type: "string" },
        body: { type: "string" },
        cc: { type: "string" },
        bcc: { type: "string" },
      },
      required: ["to", "subject", "body"],
    },
  },
  {
    name: "drive_list",
    description: "List recently modified Google Drive files. READ-ONLY.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Optional Drive q= filter" },
        pageSize: { type: "number" },
      },
    },
  },
  {
    name: "calendar_list",
    description: "List upcoming events on the primary calendar. READ-ONLY.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        windowHours: { type: "number" },
        maxResults: { type: "number" },
      },
    },
  },
  {
    name: "vault_write_note",
    description:
      "Write a markdown note to the vault. Folder is one of raw/wiki/projects/content/daily/runs/drafts/memory.",
    group: "vault",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string" },
        title: { type: "string" },
        body: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
      required: ["folder", "title", "body"],
    },
  },
  {
    name: "vault_read",
    description: "Read a markdown note from the vault by relative path.",
    group: "vault",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string" },
      },
      required: ["path"],
    },
  },
  {
    name: "firecrawl_scrape",
    description:
      "Scrape a single URL via Firecrawl and return clean markdown. Use for research, competitor pages, news articles.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
      },
      required: ["url"],
    },
  },
  {
    name: "youtube_recent",
    description: "Fetch recent uploads from the configured YouTube channel with view + like counts.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number" },
      },
    },
  },
  {
    name: "instagram_stats",
    description: "Return Instagram account stats (followers, follows, media count) and per-post engagement on recent posts. READ-ONLY.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent posts to fetch (default 12)" },
      },
    },
  },
  {
    name: "tiktok_stats",
    description: "Return TikTok creator stats (followers, following, likes, videos) and recent video engagement. READ-ONLY.",
    group: "integration",
    riskLevel: "low",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Number of recent videos to fetch (default 10)" },
      },
    },
  },
  {
    name: "mcp_call",
    description:
      "Call a tool on a connected MCP server. Use after listing tools to confirm the name. APPROVAL-GATED for mutating tools.",
    group: "mcp",
    riskLevel: "medium",
    requiresApproval: true,
    inputSchema: {
      type: "object",
      properties: {
        serverId: { type: "string" },
        toolName: { type: "string" },
        args: { type: "object" },
      },
      required: ["serverId", "toolName"],
    },
  },
];

const byName = new Map(toolRegistry.map((tool) => [tool.name, tool]));

export function getToolDefinition(name: string): ToolDefinition | undefined {
  return byName.get(name);
}

export function listAllowedTools(allowList?: string[]): ToolDefinition[] {
  if (!allowList || !allowList.length) return toolRegistry;
  return toolRegistry.filter((t) => allowList.includes(t.name));
}
