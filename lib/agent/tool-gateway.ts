/**
 * Tool gateway — exposes every direct AgenticOS adapter as a JSON-schema tool
 * list that local LLM runtimes (Ollama, llama.cpp, vLLM) can consume for
 * function-calling prompting.
 *
 * Mirrors the tools in `scripts/mcp-server.mjs` so MCP-capable CLIs and
 * Ollama see the same surface.
 */

import { fetchCommentSummary, fetchInstagramStats, fetchRecentMedia } from "@/lib/integrations/instagram";
import { fetchTikTokStats, fetchRecentVideos } from "@/lib/integrations/tiktok";
import { fetchYoutubeStats, fetchYoutubeLatest } from "@/lib/integrations/youtube";
import { getBalance, recentCharges } from "@/lib/integrations/stripe";
import { listOrders } from "@/lib/integrations/shopify";
import { listContacts as listHubspotContacts } from "@/lib/integrations/hubspot";
import { listPersons as listPipedrivePersons } from "@/lib/integrations/pipedrive";
import { listAccounts as listSfAccounts } from "@/lib/integrations/salesforce";
import { listTodayAgenda, detectConflicts } from "@/lib/integrations/calendar";
import { listRecentFiles, searchFiles } from "@/lib/integrations/drive";
import { scrapeUrl } from "@/lib/integrations/firecrawl";
import { semanticSearch } from "@/lib/memory/embeddings";
import { writeVaultMarkdown } from "@/lib/vault/service";
import { getMemoryItemsByIds, listApprovals } from "@/lib/db/repositories";
import { getDayUsage } from "@/lib/billing/meter";
import { proposeAction } from "@/lib/approvals/queue";
import { redact } from "@/lib/secrets/redact";

export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

interface ToolEntry {
  schema: ToolSchema;
  handler: ToolHandler;
}

function obj(properties: Record<string, unknown>, required: string[] = []): ToolSchema["parameters"] {
  return { type: "object", properties, required };
}

export const TOOLS: ToolEntry[] = [
  {
    schema: {
      name: "instagram_stats",
      description: "Return Instagram account stats (followers, follows, media count).",
      parameters: obj({}),
    },
    handler: async () => (await fetchInstagramStats()) ?? { error: "Instagram not configured" },
  },
  {
    schema: {
      name: "instagram_recent_media",
      description: "List recent Instagram posts with likes and comment counts.",
      parameters: obj({ limit: { type: "number" } }),
    },
    handler: async (args) => fetchRecentMedia((args.limit as number) ?? 12),
  },
  {
    schema: {
      name: "instagram_comment_summary",
      description: "Return total comments across recent Instagram posts plus per-post comment counts.",
      parameters: obj({ limit: { type: "number" } }),
    },
    handler: async (args) => fetchCommentSummary((args.limit as number) ?? 12),
  },
  {
    schema: {
      name: "tiktok_stats",
      description: "TikTok creator stats: followers / following / likes / videos.",
      parameters: obj({}),
    },
    handler: async () => (await fetchTikTokStats()) ?? { error: "TikTok not configured" },
  },
  {
    schema: {
      name: "tiktok_recent_videos",
      description: "List recent TikTok videos with engagement counts.",
      parameters: obj({ limit: { type: "number" } }),
    },
    handler: async (args) => fetchRecentVideos((args.limit as number) ?? 10),
  },
  {
    schema: {
      name: "youtube_channel",
      description: "YouTube channel stats + latest upload.",
      parameters: obj({}),
    },
    handler: async () => ({ stats: await fetchYoutubeStats(), latest: await fetchYoutubeLatest() }),
  },
  {
    schema: {
      name: "stripe_balance",
      description: "Stripe balance (available + pending).",
      parameters: obj({}),
    },
    handler: async () => getBalance(),
  },
  {
    schema: {
      name: "stripe_recent_charges",
      description: "Recent Stripe charges (read-only).",
      parameters: obj({}),
    },
    handler: async () => (await recentCharges()).data,
  },
  {
    schema: {
      name: "shopify_recent_orders",
      description: "List recent Shopify orders.",
      parameters: obj({}),
    },
    handler: async () => listOrders(),
  },
  {
    schema: {
      name: "hubspot_contacts",
      description: "Recent HubSpot contacts.",
      parameters: obj({}),
    },
    handler: async () => listHubspotContacts(),
  },
  {
    schema: {
      name: "pipedrive_persons",
      description: "Pipedrive people directory.",
      parameters: obj({}),
    },
    handler: async () => listPipedrivePersons(),
  },
  {
    schema: {
      name: "salesforce_accounts",
      description: "Recent Salesforce accounts.",
      parameters: obj({}),
    },
    handler: async () => listSfAccounts(),
  },
  {
    schema: {
      name: "calendar_today",
      description: "Today's Google Calendar agenda with overlap detection.",
      parameters: obj({}),
    },
    handler: async () => {
      const events = await listTodayAgenda();
      const conflicts = await detectConflicts(events);
      return { events, conflicts };
    },
  },
  {
    schema: {
      name: "drive_recent",
      description: "Recently modified Google Drive files (or search if `query` is provided).",
      parameters: obj({ query: { type: "string" } }),
    },
    handler: async (args) => (args.query ? searchFiles(args.query as string) : listRecentFiles()),
  },
  {
    schema: {
      name: "firecrawl_scrape",
      description: "Scrape a URL via Firecrawl. Returns markdown.",
      parameters: obj({ url: { type: "string" } }, ["url"]),
    },
    handler: async (args) => scrapeUrl(args.url as string),
  },
  {
    schema: {
      name: "vault_write_note",
      description: "Write a markdown note into vault/<folder>/.",
      parameters: obj(
        {
          folder: { type: "string" },
          title: { type: "string" },
          body: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
        ["folder", "title", "body"],
      ),
    },
    handler: async (args) =>
      writeVaultMarkdown(args.folder as string, args.title as string, args.body as string, {
        frontmatter: { tags: (args.tags as string[]) ?? [] },
      }),
  },
  {
    schema: {
      name: "vault_search",
      description: "Semantic search over vault memory.",
      parameters: obj({ query: { type: "string" }, k: { type: "number" } }, ["query"]),
    },
    handler: async (args) => {
      const matches = await semanticSearch(args.query as string, (args.k as number) ?? 8);
      const items = await getMemoryItemsByIds(matches.map((m) => m.memoryId));
      return matches.map((m) => ({ ...m, item: items.find((i) => i.id === m.memoryId) }));
    },
  },
  {
    schema: {
      name: "billing_today",
      description: "AgenticOS run cost + tokens used today.",
      parameters: obj({}),
    },
    handler: async () => getDayUsage(),
  },
  {
    schema: {
      name: "approvals_list",
      description: "List approval requests so the model can flag pending ones to the user.",
      parameters: obj({}),
    },
    handler: async () => listApprovals(),
  },
  {
    schema: {
      name: "propose_write",
      description:
        "Enqueue a destructive action for human approval. Use this instead of calling write tools directly. The user will approve or reject from /approvals.",
      parameters: obj(
        {
          action: { type: "string" },
          integration: { type: "string" },
          affectedResource: { type: "string" },
          commandOrPayload: { type: "string" },
          riskLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
          explanation: { type: "string" },
        },
        ["action", "integration", "affectedResource", "commandOrPayload", "riskLevel", "explanation"],
      ),
    },
    handler: async (args) =>
      proposeAction({
        action: args.action as string,
        integration: args.integration as string,
        affectedResource: args.affectedResource as string,
        commandOrPayload: args.commandOrPayload as string,
        riskLevel: args.riskLevel as "low" | "medium" | "high" | "critical",
        explanation: args.explanation as string,
      }),
  },
];

export function listToolSchemas(): ToolSchema[] {
  return TOOLS.map((t) => t.schema);
}

/** Adapt to the OpenAI / Ollama function-call JSON shape. */
export function listToolSchemasOpenAI(): Array<{ type: "function"; function: ToolSchema }> {
  return TOOLS.map((t) => ({ type: "function" as const, function: t.schema }));
}

export async function invokeTool(name: string, args: Record<string, unknown>): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  const tool = TOOLS.find((t) => t.schema.name === name);
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` };
  try {
    const result = await tool.handler(args ?? {});
    return { ok: true, result: await redact(result) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "tool invocation failed";
    return { ok: false, error: await redact(message) };
  }
}
