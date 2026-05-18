import { NextResponse } from "next/server";
import { z } from "zod";
import {
  getAuthenticatedUser,
  listUserRepos,
  listPulls,
  listIssues,
} from "@/lib/integrations/github";
import { proposeAction } from "@/lib/approvals/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ReadSchema = z.object({
  mode: z.enum(["user", "repos", "pulls", "issues"]),
  repo: z.string().optional(),
  state: z.enum(["open", "closed", "all"]).optional().default("open"),
});

const CommentSchema = z.object({
  mode: z.literal("comment"),
  repo: z.string().min(1),
  number: z.number().int().positive(),
  body: z.string().min(1).max(20_000),
});

const CreateIssueSchema = z.object({
  mode: z.literal("create-issue"),
  repo: z.string().min(1),
  title: z.string().min(1).max(200),
  body: z.string().max(20_000).optional(),
  labels: z.array(z.string()).max(10).optional(),
});

export async function POST(request: Request) {
  try {
    const json = await request.json();

    // Write paths: always go through the approval queue first.
    if (json?.mode === "comment") {
      const body = CommentSchema.parse(json);
      const approval = await proposeAction({
        action: `Post comment on ${body.repo}#${body.number}`,
        integration: "github",
        affectedResource: `${body.repo}#${body.number}`,
        commandOrPayload: JSON.stringify({ body: body.body.slice(0, 4000) }),
        riskLevel: "high",
        explanation: "Visible-to-others write on GitHub. Approve to post the comment.",
      });
      return NextResponse.json({ ok: true, queued: true, approvalId: approval.id });
    }
    if (json?.mode === "create-issue") {
      const body = CreateIssueSchema.parse(json);
      const approval = await proposeAction({
        action: `Create issue in ${body.repo}: ${body.title}`,
        integration: "github",
        affectedResource: body.repo,
        commandOrPayload: JSON.stringify({ title: body.title, body: body.body?.slice(0, 2000), labels: body.labels }),
        riskLevel: "high",
        explanation: "Creates a public issue on GitHub. Approve to file it.",
      });
      return NextResponse.json({ ok: true, queued: true, approvalId: approval.id });
    }

    const body = ReadSchema.parse(json);
    switch (body.mode) {
      case "user":
        return NextResponse.json({ ok: true, user: await getAuthenticatedUser() });
      case "repos":
        return NextResponse.json({ ok: true, repos: await listUserRepos() });
      case "pulls":
        if (!body.repo) return NextResponse.json({ ok: false, error: "repo required" }, { status: 400 });
        return NextResponse.json({ ok: true, pulls: await listPulls(body.repo, body.state) });
      case "issues":
        if (!body.repo) return NextResponse.json({ ok: false, error: "repo required" }, { status: 400 });
        return NextResponse.json({ ok: true, issues: await listIssues(body.repo, body.state) });
    }
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Bad request" },
      { status: 400 },
    );
  }
}
