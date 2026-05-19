import { titleFromPrompt } from "@/lib/utils";
import type { CarouselSlideSpec, GeneratedArtifact, Skill, ToolCallRequest } from "@/types";

const TEMPLATE_NOISE = [
  /^you are\b/i,
  /^##?\s*(objective|process|constraints|output|rules|instructions|context|task)\b/i,
  /^\d+\.\s/i,
  /^-\s/i,
  /^call\s+/i,
  /^return\s+/i,
  /^use\s+/i,
  /^persist\b/i,
  /^save\b/i,
  /^voice:/i,
  /^hook\s*</i,
];

function cleanLine(line: string): string {
  return line
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^\d+[\).]\s*/, "")
    .replace(/^[-:]\s*/, "")
    .trim();
}

function looksLikeTemplateInstruction(line: string): boolean {
  const clean = cleanLine(line);
  if (!clean) return true;
  if (clean.length < 8 || clean.length > 180) return true;
  if (TEMPLATE_NOISE.some((pattern) => pattern.test(clean))) return true;
  if (/render_(carousel|thumbnail)|generate_image|vault_write_note|toolcall/i.test(clean)) return true;
  if (/senior brand designer|thumbnail designer|distribution strategist|specialist/i.test(clean)) return true;
  return false;
}

function meaningfulLines(text: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const clean = cleanLine(raw);
    if (looksLikeTemplateInstruction(clean)) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(clean);
  }
  return out;
}

function inferBrief(prompt: string, generated = "", fallback = "Business Artifact"): string {
  const explicit = prompt.match(/\b(?:brief|topic|idea|campaign|about|task)\s*[:=]\s*["']?([^\r\n"']{8,180})/i);
  if (explicit?.[1]) return cleanLine(explicit[1]);

  const promptLine = meaningfulLines(prompt)[0];
  if (promptLine) return promptLine;

  const generatedLine = meaningfulLines(generated)[0];
  if (generatedLine) return generatedLine;

  return fallback;
}

function clampText(text: string, max = 90): string {
  const clean = cleanLine(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, Math.max(0, max - 3)).trim()}...`;
}

function clampWords(text: string, maxWords: number): string {
  const words = cleanLine(text).split(/\s+/).filter(Boolean);
  return words.slice(0, maxWords).join(" ");
}

function titleFromBrief(brief: string): string {
  return titleFromPrompt(brief).replace(/\.\.\.$/, "");
}

function slideFromLine(line: string, index: number): CarouselSlideSpec {
  const clean = cleanLine(line);
  const split = clean.match(/^(.{8,42}?)(?:\s+-\s+|\s+:\s+)(.{8,})$/);
  if (split) {
    return {
      title: clampText(split[1], 30),
      body: clampText(split[2], 110),
    };
  }
  const title = clampWords(clean, index === 0 ? 6 : 4);
  return {
    title: title || `Point ${index + 1}`,
    body: clampText(clean, 110),
  };
}

const MIN_SLIDES = 3;
const MAX_SLIDES = 12;

function requestedSlideCount(prompt: string): number | undefined {
  const m = prompt.match(/\b(\d{1,2})\s*[- ]?\s*slide/i)
    ?? prompt.match(/\bslides?\s*[:=]\s*(\d{1,2})/i);
  if (!m) return undefined;
  const n = Number(m[1]);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, n));
}

function defaultSlideTemplates(): Array<{ title: string; bodyTpl: (topic: string) => string; footer: string }> {
  return [
    { title: "The Hook", bodyTpl: (t) => `Lead with the problem your buyer already feels about ${t}.`, footer: "Hook" },
    { title: "The Cost", bodyTpl: (t) => `${t} stays invisible when it is only explained in text.`, footer: "Problem" },
    { title: "The Shift", bodyTpl: () => "Turn the idea into one visual promise, one proof point, and one action.", footer: "Insight" },
    { title: "The System", bodyTpl: () => "Package the message as reusable slides, thumbnails, notes, and follow-up assets.", footer: "Method" },
    { title: "The Buyer", bodyTpl: () => "Make the next step obvious enough for a busy decision maker to act.", footer: "Conversion" },
    { title: "Proof", bodyTpl: (t) => `One concrete example showing ${t} working in the real world.`, footer: "Evidence" },
    { title: "Counter-Move", bodyTpl: () => "Address the most likely objection before the audience raises it.", footer: "Objection" },
    { title: "Framework", bodyTpl: () => "Name the three to five steps a reader can apply tomorrow morning.", footer: "Steps" },
    { title: "Mistakes", bodyTpl: () => "Spell out the trap most teams fall into and how to avoid it.", footer: "Trap" },
    { title: "Tooling", bodyTpl: () => "Point at the artefacts, dashboards, or runs that make this repeatable.", footer: "Stack" },
    { title: "Recap", bodyTpl: (t) => `In one breath: what ${t} unlocks and why now.`, footer: "Summary" },
    { title: "Next Move", bodyTpl: () => "Use this artefact, measure response, and iterate the strongest angle.", footer: "CTA" },
  ];
}

function defaultSlides(brief: string, count: number, variant = 1): CarouselSlideSpec[] {
  const topic = titleFromBrief(brief);
  const suffix = variant > 1 ? ` v${variant}` : "";
  const templates = defaultSlideTemplates();
  const target = Math.min(MAX_SLIDES, Math.max(MIN_SLIDES, count));
  const slides: CarouselSlideSpec[] = [];
  for (let i = 0; i < target; i += 1) {
    const tpl = templates[i] ?? templates[templates.length - 1];
    slides.push({
      title: i === 0 ? (clampWords(topic, 6) || `Hook${suffix}`) : tpl.title,
      body: clampText(tpl.bodyTpl(clampText(topic, 60)), 110),
      footer: tpl.footer,
    });
  }
  return slides;
}

function carouselSlides(prompt: string, generated: string, variant = 1): CarouselSlideSpec[] {
  const brief = inferBrief(prompt, generated);
  const requested = requestedSlideCount(prompt) ?? 6;
  const lines = meaningfulLines(generated).slice(0, MAX_SLIDES);
  if (lines.length >= 3) {
    const slides: CarouselSlideSpec[] = [
      { title: clampWords(titleFromBrief(brief), 6), body: "A practical angle worth saving and sharing.", footer: "Hook" },
      ...lines.map(slideFromLine),
      { title: "Next Move", body: "Turn this into a concrete campaign, offer, or operating asset.", footer: "CTA" },
    ];
    if (slides.length >= requested) return slides.slice(0, requested);
    const filler = defaultSlides(brief, requested - slides.length + 1, variant).slice(1);
    return [...slides, ...filler].slice(0, requested);
  }
  return defaultSlides(brief, requested, variant);
}

function thumbnailArgs(prompt: string, generated: string, variant = 1): Record<string, unknown> {
  const brief = inferBrief(prompt, generated, "Business Thumbnail");
  const title = clampWords(titleFromBrief(brief), 5) || "Business Signal";
  const subtitle = variant > 1
    ? `Variant ${variant}: ${clampText(brief, 64)}`
    : clampText(brief, 72);
  const lower = prompt.toLowerCase();
  const badge = lower.includes("youtube") ? "VIDEO" : lower.includes("ad") ? "AD" : "BRAND";
  return {
    title,
    subtitle,
    badge,
    aspect: lower.includes("story") || lower.includes("short") ? "9:16" : "16:9",
    variantGroup: variant > 1 ? `v${variant}` : undefined,
  };
}

function carouselArgs(prompt: string, generated: string, variant = 1): Record<string, unknown> {
  const brief = inferBrief(prompt, generated, "Business Carousel");
  const lower = prompt.toLowerCase();
  return {
    title: titleFromBrief(brief) || "Business Carousel",
    slides: carouselSlides(prompt, generated, variant),
    aspect: lower.includes("linkedin") ? "1:1" : lower.includes("story") ? "9:16" : "4:5",
    variantGroup: variant > 1 ? `v${variant}` : undefined,
  };
}

function hasArtifactKind(artifacts: GeneratedArtifact[], kind: GeneratedArtifact["kind"]): boolean {
  return artifacts.some((artifact) => artifact.kind === kind);
}

const CAROUSEL_INTENT = /\bcarousel\b|\bslide(?:s|deck)?\b|\bslide-?deck\b/i;
const THUMBNAIL_INTENT = /\bthumbnail\b|\bhero\s+image\b|\bcover\s+art\b/i;
const IMAGE_INTENT = /\b(?:generate|create|make|design)\s+(?:an?\s+)?image\b|\billustration\b|\bposter\b/i;

/** Detect visual artifact intent from prompt alone, ignoring skill config.
 *  Used to render artifacts even when the user did not pick a useTools skill. */
export function buildIntentArtifactCalls(
  prompt: string,
  generated: string,
  existingArtifacts: GeneratedArtifact[],
): ToolCallRequest[] {
  const calls: ToolCallRequest[] = [];
  if (CAROUSEL_INTENT.test(prompt) && !hasArtifactKind(existingArtifacts, "carousel")) {
    calls.push({ name: "render_carousel", args: carouselArgs(prompt, generated) });
  }
  if (THUMBNAIL_INTENT.test(prompt) && !hasArtifactKind(existingArtifacts, "thumbnail")) {
    calls.push({ name: "render_thumbnail", args: thumbnailArgs(prompt, generated) });
  }
  if (IMAGE_INTENT.test(prompt) && !hasArtifactKind(existingArtifacts, "image")) {
    calls.push({
      name: "generate_image",
      args: { prompt: inferBrief(prompt, generated, "Concept illustration"), size: "1024x1024" },
    });
  }
  return calls;
}

export function buildFallbackArtifactCalls(
  prompt: string,
  skill: Skill | undefined,
  generated: string,
  existingArtifacts: GeneratedArtifact[],
): ToolCallRequest[] {
  if (!skill?.useTools) return [];
  const tools = new Set(skill.tools ?? []);
  const calls: ToolCallRequest[] = [];
  const variantCount = Math.min(Math.max(skill.variants ?? 1, 1), 3);

  if (variantCount > 1 && existingArtifacts.length === 0) {
    const wantsThumbnail = /thumbnail|youtube|hero|cover/i.test(prompt);
    const tool = wantsThumbnail && tools.has("render_thumbnail")
      ? "render_thumbnail"
      : tools.has("render_carousel")
        ? "render_carousel"
        : tools.has("render_thumbnail")
          ? "render_thumbnail"
          : undefined;
    if (!tool) return [];
    for (let i = 1; i <= variantCount; i += 1) {
      calls.push({
        name: tool,
        args: tool === "render_thumbnail"
          ? thumbnailArgs(prompt, generated, i)
          : carouselArgs(prompt, generated, i),
      });
    }
    return calls;
  }

  if (tools.has("render_carousel") && !hasArtifactKind(existingArtifacts, "carousel")) {
    calls.push({ name: "render_carousel", args: carouselArgs(prompt, generated) });
  }

  if (tools.has("render_thumbnail") && !hasArtifactKind(existingArtifacts, "thumbnail")) {
    calls.push({ name: "render_thumbnail", args: thumbnailArgs(prompt, generated) });
  }

  return calls;
}

function deriveGmailQuery(prompt: string): string {
  const explicit = prompt.match(/\bgmail\s+query\s*[:=]\s*["']?([^\r\n"']{3,160})/i)
    ?? prompt.match(/\bquery\s*[:=]\s*["']?([^\r\n"']{3,160})/i);
  if (explicit?.[1]) return cleanLine(explicit[1]);

  const terms = ["in:inbox"];
  const lower = prompt.toLowerCase();
  if (lower.includes("unread")) terms.push("is:unread");
  if (/\btoday\b|24h|24 hours|last day/.test(lower)) {
    terms.push("newer_than:1d");
  } else {
    terms.push("newer_than:7d");
  }
  return terms.join(" ");
}

function firstUrl(prompt: string): string | undefined {
  return prompt.match(/https?:\/\/[^\s)]+/i)?.[0];
}

export function buildPreflightToolCalls(prompt: string, skill: Skill | undefined): ToolCallRequest[] {
  if (!skill?.useTools) return [];
  const tools = new Set(skill.tools ?? []);
  const calls: ToolCallRequest[] = [];

  if (tools.has("gmail_search")) {
    calls.push({ name: "gmail_search", args: { query: deriveGmailQuery(prompt), maxResults: 15 } });
  }
  if (tools.has("calendar_list")) {
    calls.push({ name: "calendar_list", args: { windowHours: 48, maxResults: 25 } });
  }
  if (tools.has("drive_list")) {
    calls.push({ name: "drive_list", args: { pageSize: 20 } });
  }
  if (tools.has("youtube_recent")) {
    calls.push({ name: "youtube_recent", args: { limit: 15 } });
  }
  if (tools.has("instagram_stats")) {
    calls.push({ name: "instagram_stats", args: { limit: 12 } });
  }
  if (tools.has("tiktok_stats")) {
    calls.push({ name: "tiktok_stats", args: { limit: 10 } });
  }
  if (tools.has("firecrawl_scrape")) {
    const url = firstUrl(prompt);
    if (url) calls.push({ name: "firecrawl_scrape", args: { url } });
  }

  return calls;
}
