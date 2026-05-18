#!/usr/bin/env node
/**
 * AgenticOS local MCP server.
 *
 * Speaks the MCP stdio JSON-RPC protocol. Every tool here is a thin shim over
 * one of the AgenticOS HTTP API routes — so the same direct adapter that
 * powers the UI panels powers MCP tool calls too.
 *
 * Boot a CLI provider (Claude Code, Codex, Gemini CLI) with this configured
 * in its `.mcp.json` / `~/.gemini/settings.json` and the CLI gets:
 *   instagram.stats, instagram.comment_summary, tiktok.recent_videos, youtube.weekly_review,
 *   stripe.balance, shopify.orders, hubspot.contacts, pipedrive.persons,
 *   salesforce.accounts, calendar.today, drive.recent, firecrawl.scrape,
 *   vault.write_note, vault.search, billing.today
 *
 * The server requires AgenticOS to be running locally — the env var
 * AGENTICOS_BASE_URL (default http://127.0.0.1:3000) is where it forwards
 * tool calls. If you've turned on AGENTICOS_AUTH_TOKEN, set it here too so
 * the server can authenticate.
 */

import readline from "node:readline";

const BASE = process.env.AGENTICOS_BASE_URL ?? "http://127.0.0.1:3000";
const AUTH = process.env.AGENTICOS_AUTH_TOKEN;

const SERVER_INFO = {
  name: "agenticos",
  version: "1.0.0",
};

const pending = new Set();

function track(promise) {
  pending.add(promise);
  promise.finally(() => {
    pending.delete(promise);
  });
}

// ---- tool definitions -------------------------------------------------------

const TOOLS = [
  {
    name: "instagram.stats",
    description:
      "Return Instagram account stats (follower count, follows, media count) via the Meta Graph API. Requires INSTAGRAM_TOKEN + INSTAGRAM_ACCOUNT_ID in the AgenticOS secret store.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/instagram/stats"),
  },
  {
    name: "instagram.recent_media",
    description: "List the N most recent Instagram posts with likes / comments / permalinks.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 12 } } },
    call: (args) => httpGet(`/api/integrations/instagram/media?limit=${args?.limit ?? 12}`),
  },
  {
    name: "instagram.comment_summary",
    description: "Return total comments across recent Instagram posts plus per-post comment counts.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 12 } } },
    call: (args) => httpGet(`/api/integrations/instagram/comments?limit=${args?.limit ?? 12}`),
  },
  {
    name: "tiktok.stats",
    description: "TikTok creator stats: followers, following, likes, video count.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/tiktok/stats"),
  },
  {
    name: "tiktok.recent_videos",
    description: "List recent TikTok videos with view / like / comment / share counts.",
    inputSchema: { type: "object", properties: { limit: { type: "number", default: 10 } } },
    call: (args) => httpGet(`/api/integrations/tiktok/videos?limit=${args?.limit ?? 10}`),
  },
  {
    name: "youtube.channel",
    description: "YouTube channel stats and latest upload (from the Data API key in AgenticOS).",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/youtube/channel"),
  },
  {
    name: "youtube.weekly_review",
    description: "Last 7 days of YouTube uploads with view counts + tally classification.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/youtube/weekly"),
  },
  {
    name: "stripe.balance",
    description: "Stripe balance (available + pending).",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/stripe?mode=balance"),
  },
  {
    name: "stripe.charges",
    description: "Recent Stripe charges (read-only).",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/stripe?mode=charges"),
  },
  {
    name: "shopify.orders",
    description: "Recent Shopify orders (read-only). To cancel an order, post to /api/integrations/shopify with mode=cancel-order to enqueue an approval.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["any", "open", "closed", "cancelled"], default: "any" },
      },
    },
    call: () => httpGet("/api/integrations/shopify?mode=orders"),
  },
  {
    name: "hubspot.contacts",
    description: "HubSpot recent contacts.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/crm?provider=hubspot&mode=contacts"),
  },
  {
    name: "pipedrive.persons",
    description: "Pipedrive people directory.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/crm?provider=pipedrive&mode=contacts"),
  },
  {
    name: "salesforce.accounts",
    description: "Salesforce accounts (via JWT bearer flow).",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/crm?provider=salesforce&mode=contacts"),
  },
  {
    name: "calendar.today",
    description: "Today's Google Calendar agenda with overlap detection.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/integrations/calendar?mode=today"),
  },
  {
    name: "drive.recent",
    description: "Recently modified Google Drive files.",
    inputSchema: {
      type: "object",
      properties: { query: { type: "string", description: "Optional substring filter on file name." } },
    },
    call: (args) =>
      args?.query
        ? httpGet(`/api/integrations/drive?q=${encodeURIComponent(args.query)}`)
        : httpGet("/api/integrations/drive"),
  },
  {
    name: "firecrawl.scrape",
    description: "Scrape a URL via Firecrawl. Returns markdown.",
    inputSchema: {
      type: "object",
      required: ["url"],
      properties: {
        url: { type: "string" },
        saveToVault: { type: "boolean", default: false },
      },
    },
    call: (args) =>
      httpPost("/api/integrations/firecrawl", { mode: "scrape", url: args.url, saveToVault: args.saveToVault ?? false }),
  },
  {
    name: "vault.write_note",
    description: "Write a markdown note into vault/<folder>/.",
    inputSchema: {
      type: "object",
      required: ["folder", "title", "body"],
      properties: {
        folder: { type: "string", default: "raw" },
        title: { type: "string" },
        body: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    },
    call: (args) =>
      httpPost("/api/vault", {
        folder: args.folder ?? "raw",
        title: args.title,
        body: args.body,
        tags: args.tags ?? [],
      }),
  },
  {
    name: "vault.search",
    description: "Semantic search over indexed vault memory.",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: { query: { type: "string" }, k: { type: "number", default: 8 } },
    },
    call: (args) => httpPost("/api/memory/search", { query: args.query, k: args.k ?? 8 }),
  },
  {
    name: "billing.today",
    description: "Today's AgenticOS run cost + token total.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/billing"),
  },
  {
    name: "approvals.list",
    description: "List pending approval requests so the model can flag them to the user.",
    inputSchema: { type: "object", properties: {} },
    call: () => httpGet("/api/approvals"),
  },
];

// ---- HTTP helpers -----------------------------------------------------------

function headers() {
  const h = { "Content-Type": "application/json" };
  if (AUTH) h.Cookie = `agenticos_session=${AUTH}`;
  return h;
}

async function httpGet(path) {
  const res = await fetch(`${BASE}${path}`, { headers: headers() });
  return await res.text().then((t) => {
    try {
      return JSON.parse(t);
    } catch {
      return { ok: false, error: `Non-JSON response from ${path}`, raw: t.slice(0, 400) };
    }
  });
}

async function httpPost(path, body) {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: headers(), body: JSON.stringify(body) });
  return await res.text().then((t) => {
    try {
      return JSON.parse(t);
    } catch {
      return { ok: false, error: `Non-JSON response from ${path}`, raw: t.slice(0, 400) };
    }
  });
}

// ---- JSON-RPC plumbing ------------------------------------------------------

function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function respond(id, result) {
  send({ jsonrpc: "2.0", id, result });
}

function fail(id, code, message) {
  send({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handle(message) {
  const { id, method, params } = message;

  if (method === "initialize") {
    respond(id, {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: SERVER_INFO,
    });
    return;
  }

  if (method === "tools/list") {
    respond(id, {
      tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
    });
    return;
  }

  if (method === "tools/call") {
    const tool = TOOLS.find((t) => t.name === params?.name);
    if (!tool) {
      fail(id, -32602, `Unknown tool: ${params?.name}`);
      return;
    }
    try {
      const result = await tool.call(params?.arguments ?? {});
      respond(id, {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
        isError: result?.ok === false,
      });
    } catch (err) {
      respond(id, {
        content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
        isError: true,
      });
    }
    return;
  }

  if (method === "ping") {
    respond(id, {});
    return;
  }

  // notifications/* have no id and need no reply
  if (id === undefined) return;
  fail(id, -32601, `Method not found: ${method}`);
}

const rl = readline.createInterface({ input: process.stdin });
rl.on("line", (line) => {
  if (!line.trim()) return;
  let msg;
  try {
    msg = JSON.parse(line);
  } catch {
    return;
  }
  track(Promise.resolve(handle(msg)).catch((err) => {
    if (msg?.id !== undefined) fail(msg.id, -32603, err instanceof Error ? err.message : String(err));
  }));
});
