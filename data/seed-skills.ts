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

function template(skill: SkillSeed) {
  const base = `Run ${skill.name}. Plan first, use mock mode unless real integrations are configured, log tool calls, and save artifacts to ${skill.output ?? categoryOutput[skill.category]}.`;
  if (skill.id === "inbox-triage") {
    return "Review my inbox, identify urgent messages, summarize each important thread, draft replies where needed, and do not send anything without approval.";
  }
  if (skill.id === "content-cascade") {
    return "Turn this topic into a complete content cascade: research angle, audience, hooks, outline, YouTube script, shorts, carousel, LinkedIn post, newsletter, blog draft, CTA suggestions, and quality scores.";
  }
  if (skill.id === "deep-research") {
    return "Create a research plan, gather sources, compare source quality, summarize findings, cite sources, identify open questions, and save a report.";
  }
  return base;
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
