import type { Skill, SkillCategory } from "@/types";

type SkillSeed = Omit<Skill, "description" | "template" | "requiredIntegrations" | "riskLevel" | "outputLocation" | "enabled" | "executionMode"> & {
  integrations?: string[];
  risk?: Skill["riskLevel"];
  mode?: Skill["executionMode"];
  output?: string;
};

const categoryOutput: Record<SkillCategory, string> = {
  memory: "/vault/memory",
  productivity: "/vault/daily",
  research: "/vault/wiki",
  content: "/vault/content",
  custom: "/vault/runs",
  dev: "/vault/projects",
  business: "/vault/projects",
};

const seeds: SkillSeed[] = [
  { id: "vault-cleanup", name: "Vault Cleanup", category: "memory" },
  { id: "dream", name: "Dream", category: "memory" },
  { id: "lightrag-upload", name: "Lightrag Upload", category: "memory", integrations: ["lightrag"], risk: "medium", mode: "approval" },
  { id: "kb-status", name: "KB Status", category: "memory" },
  { id: "daily-note", name: "Daily Note", category: "memory", output: "/vault/daily" },
  { id: "knowledge-compile", name: "Knowledge Compile", category: "memory", risk: "medium" },
  { id: "memory-search", name: "Memory Search", category: "memory" },
  { id: "project-snapshot", name: "Project Snapshot", category: "memory", output: "/vault/projects" },
  { id: "morning-brief", name: "Morning Brief", category: "productivity", integrations: ["gmail", "google-calendar", "google-drive"] },
  { id: "inbox-triage", name: "Inbox Triage", category: "productivity", integrations: ["gmail"], risk: "medium", mode: "approval" },
  { id: "calendar-agenda", name: "Calendar Agenda", category: "productivity", integrations: ["google-calendar"] },
  { id: "gmail-drafts", name: "Gmail Drafts", category: "productivity", integrations: ["gmail"], risk: "high", mode: "approval" },
  { id: "drive-organizer", name: "Drive Organizer", category: "productivity", integrations: ["google-drive"], risk: "medium", mode: "approval" },
  { id: "meeting-prep", name: "Meeting Prep", category: "productivity", integrations: ["google-calendar", "google-drive"] },
  { id: "contact-follow-up", name: "Contact Follow-up", category: "productivity", integrations: ["google-contacts", "gmail"], risk: "medium", mode: "approval" },
  { id: "weekly-review", name: "Weekly Review", category: "productivity" },
  { id: "deep-research", name: "Deep Research", category: "research", integrations: ["firecrawl"] },
  { id: "yt-pipeline", name: "YT Pipeline", category: "research", integrations: ["youtube"] },
  { id: "yt-search", name: "YT Search", category: "research", integrations: ["youtube"] },
  { id: "kb-query", name: "KB Query", category: "research" },
  { id: "notebooklm", name: "NotebookLM", category: "research", integrations: ["notebooklm"], risk: "medium", mode: "approval" },
  { id: "firecrawl-scrape", name: "Firecrawl Scrape", category: "research", integrations: ["firecrawl"] },
  { id: "source-compare", name: "Source Compare", category: "research", integrations: ["firecrawl"] },
  { id: "market-research", name: "Market Research", category: "research", integrations: ["firecrawl"] },
  { id: "competitor-intel", name: "Competitor Intel", category: "research", integrations: ["firecrawl"] },
  { id: "yt-titles", name: "YT Titles", category: "content" },
  { id: "ideation", name: "Ideation", category: "content" },
  { id: "outline", name: "Outline", category: "content" },
  { id: "yt-hooks", name: "YT Hooks", category: "content" },
  { id: "content-cascade", name: "Content Cascade", category: "content", output: "/vault/content" },
  { id: "short-form", name: "Short-form", category: "content" },
  { id: "carousel", name: "Carousel", category: "content" },
  { id: "newsletter", name: "Newsletter", category: "content" },
  { id: "linkedin-post", name: "LinkedIn Post", category: "content", risk: "medium", mode: "approval" },
  { id: "blog-draft", name: "Blog Draft", category: "content" },
  { id: "script-writer", name: "Script Writer", category: "content" },
  { id: "repurpose-content", name: "Repurpose Content", category: "content" },
  { id: "shopify-cli", name: "Shopify CLI", category: "custom", integrations: ["shopify"], risk: "high", mode: "approval" },
  { id: "stripe-cli", name: "Stripe CLI", category: "custom", integrations: ["stripe"], risk: "critical", mode: "approval" },
  { id: "github-cli", name: "GitHub CLI", category: "custom", integrations: ["github"], risk: "high", mode: "approval" },
  { id: "crm", name: "CRM", category: "custom", integrations: ["crm"], risk: "high", mode: "approval" },
  { id: "any-cli", name: "Any CLI", category: "custom", risk: "critical", mode: "approval" },
  { id: "any-api", name: "Any API", category: "custom", risk: "high", mode: "approval" },
  { id: "mcp-server", name: "MCP Server", category: "custom", integrations: ["mcp"], risk: "medium", mode: "approval" },
  { id: "webhook-runner", name: "Webhook Runner", category: "custom", risk: "high", mode: "approval" },
  { id: "workflow-builder", name: "Custom Workflow Builder", category: "custom", risk: "medium", mode: "approval" },
];

function describe(skill: SkillSeed) {
  const targets: Record<SkillCategory, string> = {
    memory: "Operate on local vault memory, index notes, and preserve useful context.",
    productivity: "Summarize operational context, draft actions, and avoid external writes without approval.",
    research: "Gather source-aware findings, compare evidence, and save a cited report.",
    content: "Generate structured content artifacts with quality scoring and platform-specific drafts.",
    custom: "Route custom tools, CLIs, APIs, or MCP servers through the permission layer.",
    dev: "Assist with repository, issue, review, changelog, and release workflows.",
    business: "Summarize business systems and prepare approval-gated operations.",
  };
  return targets[skill.category];
}

const templates: Partial<Record<string, string>> = {
  "vault-cleanup": "Audit the vault for duplicate, stale, or orphaned notes. Group by recency and relevance. Flag entries older than 30 days with no references. Propose a cleanup plan with specific files to archive or delete — do not delete anything without my confirmation.",
  "dream": "Capture and structure the following dream or idea into a permanent vault note. Extract themes, symbols, recurring patterns, and emotional tone. Link to related past notes if relevant. Save to /vault/memory with tags.",
  "lightrag-upload": "Index the following content into LightRAG for semantic retrieval. Chunk appropriately, preserve source metadata, and confirm the upload. Do not modify the source files. Report the number of nodes and edges created.",
  "kb-status": "Produce a full status report of the knowledge base: total notes, coverage by category, most-referenced topics, stale entries, and gaps. Format as a structured summary with a priority list of areas to strengthen.",
  "daily-note": "Create today's daily note. Include: date, top 3 priorities, any open loops from yesterday, a morning intention, and space for evening reflection. Save to /vault/daily. Keep it concise — under 300 words.",
  "knowledge-compile": "Compile all recent vault notes (last 7 days) into a synthesized knowledge digest. Group by theme, surface key decisions and open questions, and identify emerging patterns. Save as a weekly synthesis note.",
  "memory-search": "Search the vault for notes, artifacts, and memory items related to the following query. Rank results by relevance and recency. Summarize each result in 1–2 sentences. Return the top 10 matches with vault paths.",
  "project-snapshot": "Generate a structured project snapshot: current status, completed milestones, active tasks, blockers, next steps, and key decisions made. Format as a project brief. Save to /vault/projects.",
  "morning-brief": "Generate my morning brief. Pull from: today's calendar events, unread inbox summary, top 3 priorities, pending approvals, and any vault notes flagged for today. Format as a scannable briefing document. No external writes.",
  "inbox-triage": "Triage my inbox systematically:\n1. Categorize each message: urgent, action required, FYI, or archive.\n2. Summarize each important thread in 1–2 sentences.\n3. Draft replies for action-required messages — keep them concise and direct.\n4. Propose labels or filters to prevent future clutter.\nDo not send any reply without my explicit approval.",
  "calendar-agenda": "Pull today's and tomorrow's calendar events. For each event: confirm time, attendees, and location. Surface any prep needed (docs to review, context to load). Flag conflicts or back-to-back sessions. Format as a clean agenda.",
  "gmail-drafts": "Draft the following email. Apply these standards: clear subject line, direct opening sentence, body with structured points, specific ask or CTA, professional close. Optimize for clarity and response rate. Stage for review — do not send.",
  "drive-organizer": "Audit Google Drive for: duplicates, misplaced files, folders without descriptions, and files not accessed in 90+ days. Propose a reorganization plan with specific moves. Do not move or delete anything without approval.",
  "meeting-prep": "Prepare a meeting brief for the following event. Include: objectives, attendee context, agenda, key questions to ask, documents to reference, and desired outcomes. Format for quick review 5 minutes before the meeting.",
  "contact-follow-up": "Review the following contacts and draft personalized follow-up messages. For each: reference the last interaction, acknowledge any open items, propose a next step. Keep each message under 150 words. Stage for approval before sending.",
  "weekly-review": "Run my weekly review:\n1. What did I complete this week?\n2. What's carrying over and why?\n3. What patterns or blockers emerged?\n4. What are my top 3 priorities for next week?\n5. What should I stop, start, or continue?\nSave as a structured weekly review note.",
  "deep-research": "Execute a structured research workflow on the following topic:\n1. Define the research question and scope.\n2. Identify the best source types (primary, secondary, expert opinion).\n3. Gather and summarize key findings from each source.\n4. Compare and contrast source quality and bias.\n5. Synthesize a clear answer to the research question.\n6. List open questions and recommended follow-up searches.\n7. Save a cited report with sources and confidence levels.",
  "yt-pipeline": "Run the full YouTube content pipeline for this topic:\n1. Research the topic and identify the best angle.\n2. Analyze top-performing videos in this niche (titles, thumbnails, hooks).\n3. Generate 10 title options with click-through potential scores.\n4. Write a full video script with hook, body, and CTA.\n5. Produce a description, tags, and chapter timestamps.\n6. Save all assets to /vault/content.",
  "yt-search": "Search YouTube for content related to the following query. Identify: top videos by views and engagement, common title patterns, topic gaps the competition misses, and audience sentiment from comments. Return a structured intelligence report.",
  "kb-query": "Answer the following question using only what's in the knowledge base. If the answer isn't there, say so clearly and suggest which sources to add. Cite specific vault notes. Do not hallucinate facts.",
  "notebooklm": "Upload the following sources to NotebookLM and generate: a summary, key themes, notable quotes, and a set of research questions. Return the NotebookLM link and a structured summary of what was uploaded.",
  "firecrawl-scrape": "Scrape the following URL(s) and extract: main content, key data points, structured sections, and metadata. Clean the output — remove boilerplate, ads, and navigation. Return well-formatted markdown ready for vault storage.",
  "source-compare": "Compare the following sources on the given topic. For each source: summarize the main argument, identify supporting evidence, note gaps or biases. Then produce a comparative analysis: where they agree, where they diverge, and which is most credible.",
  "market-research": "Conduct market research on the following topic or product category:\n1. Market size and growth trajectory.\n2. Key players and their positioning.\n3. Customer pain points and unmet needs.\n4. Pricing landscape.\n5. Emerging trends and threats.\n6. White space opportunities.\nSave as a structured market report with sources.",
  "competitor-intel": "Research the following competitor and produce an intelligence report:\n1. Product/service overview and positioning.\n2. Pricing model.\n3. Target customer and ICP.\n4. Key strengths and weaknesses.\n5. Recent moves (funding, product launches, partnerships).\n6. How to differentiate against them.",
  "yt-titles": "Generate 15 high-performing YouTube title options for the following topic. For each title: apply proven formulas (curiosity gap, number list, how-to, controversy, transformation). Score each on: click-through potential, SEO alignment, and audience fit. Flag the top 3 with rationale.",
  "ideation": "Generate a structured ideation session on the following topic or challenge:\n1. 10 conventional ideas (safe, proven).\n2. 10 unconventional ideas (contrarian, unexpected).\n3. 5 wild ideas (no constraints).\n4. Top 3 recommendations with rationale.\nFor each recommended idea: define the opportunity, the risk, and the first action to validate it.",
  "outline": "Create a detailed content outline for the following topic. Include: working title, target audience and their key pain point, hook strategy, 5–7 main sections with subpoints, transition logic between sections, and a strong closing CTA. The outline should be executable — a writer could use it without asking questions.",
  "yt-hooks": "Write 10 YouTube video hooks for the following topic. Each hook should: open with a pattern interrupt, state a compelling promise or tension, and be under 30 seconds when spoken aloud. Score each on: retention likelihood and emotional pull. Flag the top 3.",
  "content-cascade": "Execute a full content cascade for the following topic:\n1. **Research** — angle, audience, key insight.\n2. **Hook variants** — 5 hooks across curiosity, controversy, and transformation frames.\n3. **YouTube script** — hook, structured body, CTA (1000–1500 words).\n4. **YouTube Shorts** — 3 × 60-second vertical scripts.\n5. **Carousel** — 10-slide LinkedIn/Instagram carousel with slide-by-slide copy.\n6. **LinkedIn post** — 150-word thought leadership post.\n7. **Newsletter section** — 200-word digest-ready summary.\n8. **Blog draft** — SEO-structured article outline with intro paragraph.\n9. **Quality scores** — rate each asset on clarity, novelty, hook strength, audience fit, and CTA.\nSave all assets to /vault/content.",
  "short-form": "Write 5 short-form content pieces (under 280 characters each) for the following topic. Formats: tweet thread opener, LinkedIn hook, Instagram caption, TikTok text overlay, and SMS/push notification. Each must stand alone and drive engagement.",
  "carousel": "Design a 10-slide content carousel for the following topic. For each slide: write the headline (under 10 words), body copy (under 40 words), and a visual direction note. Slide 1 = hook. Slide 10 = CTA. Ensure logical progression and retention between slides.",
  "newsletter": "Write a complete newsletter issue on the following topic. Structure: subject line (A/B variants), preview text, personal opening (2–3 sentences), main content section (400–600 words with clear takeaways), a curated resource or tool recommendation, and a direct CTA. Tone: conversational, expert, valuable.",
  "linkedin-post": "Write a high-performing LinkedIn post on the following topic. Apply this structure: hook line (pattern interrupt), 3–5 short paragraphs with line breaks, a key insight or contrarian take, a question or CTA to drive comments. Under 700 characters. Stage for approval before posting.",
  "blog-draft": "Write a complete blog draft on the following topic. Structure: SEO-optimized title, meta description (under 160 chars), introduction with hook, 4–6 body sections with H2 headings, internal link placeholders, conclusion with takeaway, and CTA. Target 1200–1800 words. Optimize for readability (short paragraphs, active voice).",
  "script-writer": "Write a complete video script for the following topic. Include: hook (first 30 seconds), structured body with clear transitions, B-roll cues, on-screen text suggestions, and a strong close with CTA. Optimize for spoken delivery — short sentences, natural rhythm, no jargon.",
  "repurpose-content": "Repurpose the following content into 5 formats:\n1. Twitter/X thread (10 tweets)\n2. LinkedIn post (under 700 chars)\n3. YouTube short script (60 seconds)\n4. Email newsletter section (200 words)\n5. Instagram caption with hashtags\nPreserve the core insight. Adapt tone and format for each platform.",
  "shopify-cli": "Stage the following Shopify CLI operation for review. Specify: the exact command(s) to run, what they will modify (products, collections, themes, orders), estimated impact, and rollback steps. Do not execute until I approve.",
  "stripe-cli": "Stage the following Stripe CLI operation for review. Specify: the exact command(s), what financial objects will be affected (charges, refunds, subscriptions, webhooks), risk level, and how to verify the result. This is a critical-risk operation — explicit approval required before execution.",
  "github-cli": "Stage the following GitHub CLI operation for review. Specify: the exact `gh` commands, which repositories and resources are affected, whether this creates, modifies, or deletes anything, and the expected output. Approval required before execution.",
  "crm": "Stage the following CRM operation for review. Specify: which records will be created, updated, or deleted, what integrations will be triggered, and the expected downstream effects. Do not commit any changes without approval.",
  "any-cli": "Stage the following CLI command for review. Show: the exact command, working directory, environment variables required, expected output, and potential side effects. Risk level: critical. Approval required before execution.",
  "any-api": "Stage the following API call for review. Show: method, endpoint, headers, request body, authentication method, and expected response. Identify any state-changing operations (POST, PUT, DELETE, PATCH). Approval required before execution.",
  "mcp-server": "Configure and connect the following MCP server. Specify: server name, transport type, required env vars, available tools, and any data it can access. Run in dry-run mode first and report the tool manifest before enabling.",
  "webhook-runner": "Stage the following webhook for review. Show: target URL, HTTP method, payload schema, authentication, retry logic, and what system will receive it. Flag any sensitive data in the payload. Approval required before sending.",
  "workflow-builder": "Design a custom agentic workflow for the following goal. Define: trigger, steps in order, tools required for each step, risk level per step, approval gates, expected outputs, and vault save locations. Return a structured workflow spec I can review and enable.",
};

function template(skill: SkillSeed) {
  if (templates[skill.id]) return templates[skill.id]!;
  return `Run ${skill.name} for the following task. Plan each step before executing. Use mock mode unless real integrations are confirmed. Log all tool calls with their inputs and outputs. Save all artifacts to ${skill.output ?? categoryOutput[skill.category]}. Report results in a structured format with a clear summary, key findings, and recommended next actions.`;
}

export const seedSkills: Skill[] = seeds.map((skill) => ({
  id: skill.id,
  name: skill.name,
  category: skill.category,
  description: describe(skill),
  template: template(skill),
  requiredIntegrations: skill.integrations ?? [],
  riskLevel: skill.risk ?? "low",
  outputLocation: skill.output ?? categoryOutput[skill.category],
  enabled: true,
  executionMode: skill.mode ?? "dry-run",
}));
