import type { ModelEndpoint, Skill } from "@/types";

export interface GenerateWithModelRequest {
  provider: ModelEndpoint;
  model: string;
  prompt: string;
  skill?: Skill;
  memoryCount: number;
  projectContext?: string;
}

function systemPrompt(skill?: Skill, projectContext?: string) {
  return [
    "You are AgenticOS, an expert AI workflow operator with deep knowledge across research, content, productivity, and automation domains.",
    "",
    "## Response Standards",
    "- Structure every response with clear headings, logical sections, and progressive depth.",
    "- Lead with the most important insight or action. Never bury the lede.",
    "- Use numbered lists for sequential steps, bullet lists for parallel options or facts.",
    "- Include concrete examples, specific recommendations, and measurable next steps.",
    "- When producing content artifacts, match the format exactly to the target platform.",
    "- Cite sources, name tools, and reference real options — avoid vague generalities.",
    "- Close every response with a prioritized action section the user can act on immediately.",
    "",
    "## Tone and Voice",
    "- Direct, expert, and precise — like a senior consultant who respects the user's time.",
    "- Confident but not overconfident. Acknowledge limits when they exist.",
    "- No filler phrases, no hedging, no padding.",
    skill ? `\n## Active Skill: ${skill.name}` : undefined,
    skill ? `Category: ${skill.category} | Output: ${skill.outputLocation}` : undefined,
    skill ? `Produce output exactly matched to this skill's purpose. Stay focused on the task.` : undefined,
    projectContext ? `\n${projectContext}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(prompt: string, memoryCount: number) {
  return [
    "## Task",
    prompt,
    "",
    "## Context",
    `- Local memory items indexed: ${memoryCount}`,
    "- Execution environment: local-first, dry-run unless credentials are confirmed",
    "",
    "## Instructions",
    "Produce a complete, well-structured response. Use markdown headings and lists.",
    "Be specific — name tools, formats, and concrete actions. End with prioritized next steps.",
  ].join("\n");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 60_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function generateWithOllama(request: GenerateWithModelRequest) {
  const response = await fetchWithTimeout(`${request.provider.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      stream: false,
      messages: [
        { role: "system", content: systemPrompt(request.skill, request.projectContext) },
        { role: "user", content: userPrompt(request.prompt, request.memoryCount) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}`);
  }

  const body = (await response.json()) as { message?: { content?: string }; response?: string };
  const content = body.message?.content ?? body.response;

  if (!content?.trim()) {
    throw new Error("Ollama returned an empty response");
  }

  return content.trim();
}

async function generateWithNvidia(request: GenerateWithModelRequest) {
  const apiKey = process.env.NVIDIA_API_KEY;

  if (!apiKey) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }

  const response = await fetchWithTimeout(`${request.provider.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: request.model,
      temperature: 0.4,
      max_tokens: 2048,
      messages: [
        { role: "system", content: systemPrompt(request.skill, request.projectContext) },
        { role: "user", content: userPrompt(request.prompt, request.memoryCount) },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`NVIDIA returned ${response.status}`);
  }

  const body = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = body.choices?.[0]?.message?.content;

  if (!content?.trim()) {
    throw new Error("NVIDIA returned an empty response");
  }

  return content.trim();
}

export async function generateWithModel(request: GenerateWithModelRequest) {
  if (request.provider.id === "ollama") {
    return generateWithOllama(request);
  }

  if (request.provider.id === "nvidia") {
    return generateWithNvidia(request);
  }

  throw new Error(`${request.provider.provider} generation is not implemented yet`);
}
