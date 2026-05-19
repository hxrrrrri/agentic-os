import { renderCarousel, renderThumbnail, renderGeneratedImage } from "@/lib/artifacts";
import { searchGmail, createDraft as createGmailDraft } from "@/lib/integrations/gmail";
import { listRecentFiles as listDriveRecent, searchFiles as searchDrive } from "@/lib/integrations/drive";
import { listUpcomingEvents } from "@/lib/integrations/calendar";
import { scrapeUrl, isFirecrawlConfigured } from "@/lib/integrations/firecrawl";
import { fetchYoutubeRecentVideos } from "@/lib/integrations/youtube";
import { fetchInstagramStats, fetchRecentMedia } from "@/lib/integrations/instagram";
import { fetchTikTokStats, fetchRecentVideos as fetchTikTokRecent } from "@/lib/integrations/tiktok";
import { callMcpTool, listMcpTools } from "@/lib/mcp/bridge";
import { writeVaultMarkdown, resolveVaultPath } from "@/lib/vault/service";
import { getToolDefinition } from "./registry";
import { requiresApproval as needsApproval } from "@/lib/permissions/policy";
import { createId, nowIso } from "@/lib/utils";
import { addAuditLog, insertApproval, insertToolCall } from "@/lib/db/repositories";
import { emitRunEvent } from "@/lib/agent/event-bus";
import type {
  ApprovalRequest,
  GeneratedArtifact,
  PermissionLevel,
  ToolCall,
  ToolCallRequest,
  ToolCallResult,
} from "@/types";
import fs from "node:fs/promises";

export interface DispatchContext {
  runId: string;
  stepId?: string;
  skillId?: string;
  permissionLevel: PermissionLevel;
  dryRun: boolean;
  /** Artifacts produced during this dispatch run, accumulated by caller. */
  artifactSink: GeneratedArtifact[];
}

function ok(name: string, summary: string, data?: unknown, artifactIds?: string[]): ToolCallResult {
  return { callId: createId("toolcall"), ok: true, summary, data, artifactIds };
}

function fail(name: string, message: string): ToolCallResult {
  return { callId: createId("toolcall"), ok: false, summary: `${name} failed: ${message}`, error: message };
}

async function logToolCall(
  context: DispatchContext,
  toolName: string,
  args: Record<string, unknown>,
  status: ToolCall["status"],
  output: string,
  riskLevel: ToolCall["riskLevel"],
): Promise<void> {
  const call: ToolCall = {
    id: createId("tool"),
    runId: context.runId,
    stepId: context.stepId,
    tool: toolName,
    action: toolName,
    input: JSON.stringify(args).slice(0, 4000),
    output: output.slice(0, 4000),
    riskLevel,
    status,
    createdAt: nowIso(),
  };
  await insertToolCall(call).catch(() => {});
  emitRunEvent({
    runId: context.runId,
    type: "run.tool",
    payload: { tool: call.tool, action: call.action, status: call.status, risk: call.riskLevel },
  });
}

async function stageApproval(
  context: DispatchContext,
  toolName: string,
  args: Record<string, unknown>,
  riskLevel: ToolCall["riskLevel"],
): Promise<ToolCallResult> {
  const approval: ApprovalRequest = {
    id: createId("approval"),
    runId: context.runId,
    action: `${toolName} (tool-call)`,
    integration: toolName.startsWith("gmail_") ? "gmail" : toolName.startsWith("drive_") ? "google-drive" : toolName.startsWith("calendar_") ? "google-calendar" : toolName.startsWith("mcp_") ? "mcp" : "tool",
    affectedResource: "tool dispatcher",
    commandOrPayload: JSON.stringify(args).slice(0, 4000),
    riskLevel,
    explanation: `The model requested ${toolName}, which mutates external state and is approval-gated.`,
    status: "pending",
    createdAt: nowIso(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    payload: {
      kind: "tool_call",
      toolName,
      args,
      skillId: context.skillId,
      runId: context.runId,
      permissionLevel: context.permissionLevel,
    },
  };
  await insertApproval(approval).catch(() => {});
  emitRunEvent({
    runId: context.runId,
    type: "run.approval",
    payload: { approvalId: approval.id, action: approval.action, risk: approval.riskLevel },
  });
  await logToolCall(context, toolName, args, "blocked", `Blocked pending approval ${approval.id}`, riskLevel);
  return {
    callId: approval.id,
    ok: false,
    summary: `Tool ${toolName} blocked — approval ${approval.id} required. Continue the conversation without this side effect for now; the user will review.`,
    error: "approval_required",
  };
}

export interface DispatchOutcome {
  result: ToolCallResult;
  artifacts: GeneratedArtifact[];
}

/** Execute one tool call. Approval-gated tools either auto-block (and stage an
 *  approval) or short-circuit when the skill's permission level is too low.
 *  Read-only tools execute immediately. */
export async function dispatchTool(
  request: ToolCallRequest,
  context: DispatchContext,
): Promise<DispatchOutcome> {
  const definition = getToolDefinition(request.name);
  if (!definition) {
    const r = fail(request.name, `Unknown tool: ${request.name}`);
    await logToolCall(context, request.name, request.args, "failed", r.summary, "low");
    return { result: r, artifacts: [] };
  }

  const args = request.args ?? {};
  const baseArtifacts = context.artifactSink.length;

  const mustApprove =
    definition.requiresApproval === true
    || needsApproval(definition.riskLevel, context.permissionLevel);

  if (mustApprove && !context.dryRun) {
    const staged = await stageApproval(context, request.name, args, definition.riskLevel);
    return { result: staged, artifacts: [] };
  }

  try {
    let result: ToolCallResult;
    switch (request.name) {
      case "render_carousel": {
        const slides = Array.isArray(args.slides) ? (args.slides as Array<Record<string, string>>) : [];
        const variantGroup = args.variantGroup as string | undefined;
        const artifacts = await renderCarousel(
          {
            title: String(args.title ?? "Carousel"),
            slides: slides.map((s) => ({ title: s.title, body: s.body, footer: s.footer })),
            aspect: (args.aspect as "1:1" | "4:5" | "9:16" | "16:9" | undefined) ?? "1:1",
          },
          { runId: context.runId, skillId: context.skillId, variantGroup },
        );
        context.artifactSink.push(...artifacts);
        result = ok(
          request.name,
          `Rendered ${slides.length} slides. Preview: ${artifacts[artifacts.length - 1]?.path}`,
          { artifactPaths: artifacts.map((a) => a.path) },
          artifacts.map((a) => a.id),
        );
        break;
      }
      case "render_thumbnail": {
        const variantGroup = args.variantGroup as string | undefined;
        const artifact = await renderThumbnail(
          {
            title: String(args.title ?? "Thumbnail"),
            subtitle: args.subtitle as string | undefined,
            badge: args.badge as string | undefined,
            aspect: (args.aspect as "16:9" | "1:1" | "9:16" | undefined) ?? "16:9",
          },
          { runId: context.runId, skillId: context.skillId, variantGroup },
        );
        context.artifactSink.push(artifact);
        result = ok(request.name, `Rendered thumbnail at ${artifact.path}`, { artifactPath: artifact.path }, [artifact.id]);
        break;
      }
      case "generate_image": {
        const variantGroup = args.variantGroup as string | undefined;
        const artifact = await renderGeneratedImage(
          {
            prompt: String(args.prompt ?? ""),
            size: args.size as string | undefined,
            provider: args.provider as "openai" | "gemini" | "stability" | undefined,
            quality: args.quality as "low" | "standard" | "high" | undefined,
          },
          String(args.title ?? "Generated image"),
          { runId: context.runId, skillId: context.skillId, variantGroup, caption: args.prompt as string | undefined },
        );
        context.artifactSink.push(artifact);
        result = ok(request.name, `Generated image at ${artifact.path}`, { artifactPath: artifact.path }, [artifact.id]);
        break;
      }
      case "gmail_search": {
        const query = String(args.query ?? "in:inbox newer_than:7d");
        const maxResults = Number(args.maxResults ?? 15);
        const messages = await searchGmail(query, maxResults);
        if (messages === null) {
          result = fail(request.name, "Gmail not configured (set GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN).");
        } else {
          result = ok(request.name, `Found ${messages.length} Gmail message(s).`, { messages });
        }
        break;
      }
      case "gmail_create_draft": {
        const created = await createGmailDraft(
          String(args.to ?? ""),
          String(args.subject ?? ""),
          String(args.body ?? ""),
        ).catch(() => null);
        result = created
          ? ok(request.name, `Draft created: ${created.id}`, { draftId: created.id })
          : fail(request.name, "Failed to create draft");
        break;
      }
      case "drive_list": {
        const files = args.query
          ? await searchDrive(String(args.query), Number(args.pageSize ?? 20))
          : await listDriveRecent(Number(args.pageSize ?? 20));
        result = ok(request.name, `Drive returned ${files.length} file(s).`, { files });
        break;
      }
      case "calendar_list": {
        const events = await listUpcomingEvents(Number(args.maxResults ?? 25));
        result = ok(request.name, `${events.length} upcoming event(s).`, { events });
        break;
      }
      case "vault_write_note": {
        const folder = String(args.folder ?? "raw");
        const title = String(args.title ?? "untitled");
        const body = String(args.body ?? "");
        const tags = Array.isArray(args.tags) ? (args.tags as string[]) : [];
        const path = await writeVaultMarkdown(folder, title, body, { frontmatter: { tags } });
        result = ok(request.name, `Wrote ${path}`, { path });
        break;
      }
      case "vault_read": {
        const rel = String(args.path ?? "");
        const absolute = resolveVaultPath(rel);
        const raw = await fs.readFile(absolute, "utf8");
        const truncated = raw.slice(0, 12_000);
        result = ok(request.name, `Read ${rel} (${raw.length} chars)`, { path: rel, content: truncated, truncated: raw.length > truncated.length });
        break;
      }
      case "firecrawl_scrape": {
        if (!(await isFirecrawlConfigured())) {
          result = fail(request.name, "Firecrawl not configured (set FIRECRAWL_API_KEY).");
          break;
        }
        const scrape = await scrapeUrl(String(args.url ?? ""));
        const trimmed = scrape.markdown.slice(0, 18_000);
        result = ok(request.name, `Scraped ${scrape.url} (${scrape.markdown.length} chars)`, {
          url: scrape.url,
          title: scrape.title,
          markdown: trimmed,
          truncated: scrape.markdown.length > trimmed.length,
        });
        break;
      }
      case "youtube_recent": {
        const videos = await fetchYoutubeRecentVideos(Number(args.limit ?? 10));
        if (!videos) {
          result = fail(request.name, "YouTube not configured.");
        } else {
          result = ok(request.name, `${videos.length} recent video(s).`, { videos });
        }
        break;
      }
      case "instagram_stats": {
        const stats = await fetchInstagramStats();
        if (!stats) {
          result = fail(request.name, "Instagram not configured.");
          break;
        }
        const media = await fetchRecentMedia(Number(args.limit ?? 12));
        result = ok(
          request.name,
          `IG: ${stats.followers} followers, ${media.length} recent posts.`,
          { stats, media },
        );
        break;
      }
      case "tiktok_stats": {
        const stats = await fetchTikTokStats();
        if (!stats) {
          result = fail(request.name, "TikTok not configured.");
          break;
        }
        const videos = await fetchTikTokRecent(Number(args.limit ?? 10));
        result = ok(
          request.name,
          `TikTok: ${stats.followers} followers, ${videos.length} recent videos.`,
          { stats, videos },
        );
        break;
      }
      case "mcp_call": {
        const serverId = String(args.serverId ?? "");
        const toolName = String(args.toolName ?? "");
        const innerArgs = (args.args as Record<string, unknown>) ?? {};
        const tools = await listMcpTools(serverId).catch(() => []);
        if (!tools.find((t) => t.name === toolName)) {
          result = fail(request.name, `MCP tool ${toolName} not found on ${serverId}`);
        } else {
          const output = await callMcpTool(serverId, toolName, innerArgs);
          result = ok(request.name, `MCP ${serverId}/${toolName} ok`, output);
        }
        break;
      }
      default: {
        result = fail(request.name, `Tool not implemented: ${request.name}`);
      }
    }

    const status: ToolCall["status"] = result.ok ? "executed" : "failed";
    await logToolCall(context, request.name, args, status, result.summary, definition.riskLevel);
    if (result.ok) {
      await addAuditLog({
        actor: "agent",
        action: `tool:${request.name}`,
        integration: definition.group,
        riskLevel: definition.riskLevel,
        result: "completed",
      }).catch(() => {});
    }
    return {
      result,
      artifacts: context.artifactSink.slice(baseArtifacts),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "tool failed";
    const r = fail(request.name, message);
    await logToolCall(context, request.name, args, "failed", message, definition.riskLevel);
    return { result: r, artifacts: [] };
  }
}
