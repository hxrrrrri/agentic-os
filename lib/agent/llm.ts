import type { ModelEndpoint, ReasoningEffort, Skill, ThinkingLevel } from "@/types";
import { generateWithClaudeCli, generateWithCodexCli, generateWithCopilotCli, generateWithGeminiCli } from "@/lib/agent/cli";

export interface GenerateWithModelRequest {
  provider: ModelEndpoint;
  model: string;
  prompt: string;
  skill?: Skill;
  memoryCount: number;
  projectContext?: string;
  vaultContext?: string;
  vaultFileCount?: number;
  systemExtra?: string;
  thinking?: ThinkingLevel;
  reasoningEffort?: ReasoningEffort;
}

export const THINKING_BUDGETS: Record<ThinkingLevel, number> = {
  off: 0,
  think: 4000,
  "think-hard": 10000,
  "think-harder": 31999,
  ultrathink: 31999,
};

export const THINKING_KEYWORDS: Record<ThinkingLevel, string> = {
  off: "",
  think: "think",
  "think-hard": "think hard",
  "think-harder": "think harder",
  ultrathink: "ultrathink",
};

export interface GenerateWithModelResult {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
}

function systemPrompt(skill?: Skill, projectContext?: string, extra?: string) {
  return [
    "You are AgenticOS, an expert AI workflow operator with deep knowledge across research, content, productivity, automation, and engineering domains.",
    "",
    "## Response Standards",
    "- Structure every response with clear headings, logical sections, and progressive depth.",
    "- Lead with the most important insight or action. Never bury the lede.",
    "- Use numbered lists for sequential steps, bullet lists for parallel options or facts.",
    "- Include concrete examples, specific recommendations, and measurable next steps.",
    "- Output Obsidian-compatible markdown when writing to the vault — use `[[wiki-links]]` for cross-references and `#tags` where helpful.",
    "- Close every response with a prioritized action section.",
    "",
    "## Tone",
    "- Direct, expert, precise. No filler, no hedging, no padding.",
    skill ? `\n## Active Skill: ${skill.name}` : undefined,
    skill ? `Category: ${skill.category} | Output: ${skill.outputLocation}` : undefined,
    skill ? `Produce output exactly matched to this skill's purpose.` : undefined,
    projectContext ? `\n${projectContext}` : undefined,
    extra ? `\n${extra}` : undefined,
  ]
    .filter(Boolean)
    .join("\n");
}

function userPrompt(prompt: string, memoryCount: number, vaultContext?: string, vaultFileCount?: number) {
  const parts: string[] = [
    "## Task",
    prompt,
    "",
    "## Context",
    `- Local memory items indexed: ${memoryCount}`,
    `- Vault notes provided inline below: ${vaultFileCount ?? 0}`,
    "- Execution environment: local-first, dry-run unless credentials are confirmed",
    "- IMPORTANT: you do NOT have filesystem access. Use only the vault notes provided inline below — do not attempt to read the disk. If a note is needed but not present here, state that explicitly.",
  ];
  if (vaultContext && vaultContext.trim()) {
    parts.push(
      "",
      "## Vault Notes (recent activity, provided inline)",
      vaultContext,
    );
  }
  parts.push(
    "",
    "## Instructions",
    "Produce a complete, well-structured response. Use markdown headings and lists.",
    "Be specific — name tools, formats, and concrete actions. End with prioritized next steps.",
  );
  return parts.join("\n");
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 90_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function approxTokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

async function generateWithOllama(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);
  const response = await fetchWithTimeout(`${request.provider.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      stream: false,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Ollama returned ${response.status}`);

  const body = (await response.json()) as {
    message?: { content?: string };
    response?: string;
    prompt_eval_count?: number;
    eval_count?: number;
  };
  const content = (body.message?.content ?? body.response ?? "").trim();
  if (!content) throw new Error("Ollama returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.prompt_eval_count ?? approxTokens(sys + usr),
      outputTokens: body.eval_count ?? approxTokens(content),
    },
  };
}

async function generateWithNvidia(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error("NVIDIA_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);

  async function callModel(model: string) {
    const response = await fetchWithTimeout(`${request.provider.baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        max_tokens: 2048,
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
      }),
    });
    return response;
  }

  let response = await callModel(request.model);
  if (response.status === 404 && request.provider.model && request.provider.model !== request.model) {
    response = await callModel(request.provider.model);
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NVIDIA returned ${response.status}: ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("NVIDIA returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? approxTokens(sys + usr),
      outputTokens: body.usage?.completion_tokens ?? approxTokens(content),
    },
  };
}

async function generateWithAnthropic(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);

  const thinkingLevel = request.thinking ?? "off";
  const thinkingBudget = THINKING_BUDGETS[thinkingLevel];
  const useThinking = thinkingBudget > 0;
  const maxTokens = useThinking ? thinkingBudget + 4096 : 4096;

  const payload: Record<string, unknown> = {
    model: request.model,
    max_tokens: maxTokens,
    system: sys,
    messages: [{ role: "user", content: usr }],
  };
  if (useThinking) {
    payload.thinking = { type: "enabled", budget_tokens: thinkingBudget };
  }

  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Anthropic returned ${response.status}: ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  const content = body.content?.map((part) => part.text ?? "").join("").trim();
  if (!content) throw new Error("Anthropic returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usage?.input_tokens ?? approxTokens(sys + usr),
      outputTokens: body.usage?.output_tokens ?? approxTokens(content),
    },
  };
}

function isOpenAIReasoningModel(model: string): boolean {
  const m = model.toLowerCase();
  return m.startsWith("o3") || m.startsWith("o4") || m.startsWith("o1") || m.startsWith("gpt-5") || m.includes("reasoning");
}

async function generateWithOpenAI(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);
  const payload: Record<string, unknown> = {
    model: request.model,
    messages: [
      { role: "system", content: sys },
      { role: "user", content: usr },
    ],
  };
  if (request.reasoningEffort && request.reasoningEffort !== "xhigh" && isOpenAIReasoningModel(request.model)) {
    payload.reasoning_effort = request.reasoningEffort;
  }
  const response = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI returned ${response.status}: ${text.slice(0, 200)}`);
  }
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenAI returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? approxTokens(sys + usr),
      outputTokens: body.usage?.completion_tokens ?? approxTokens(content),
    },
  };
}

async function generateWithOpenRouter(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);
  const response = await fetchWithTimeout("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    }),
  });

  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("OpenRouter returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? approxTokens(sys + usr),
      outputTokens: body.usage?.completion_tokens ?? approxTokens(content),
    },
  };
}

async function generateWithGemini(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${request.model}:generateContent?key=${apiKey}`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: sys }] },
      contents: [{ role: "user", parts: [{ text: usr }] }],
    }),
  });

  if (!response.ok) throw new Error(`Gemini returned ${response.status}`);
  const body = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  const content = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim();
  if (!content) throw new Error("Gemini returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usageMetadata?.promptTokenCount ?? approxTokens(sys + usr),
      outputTokens: body.usageMetadata?.candidatesTokenCount ?? approxTokens(content),
    },
  };
}

async function generateWithGrok(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const apiKey = process.env.GROK_API_KEY ?? process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("GROK_API_KEY is not configured");

  const sys = systemPrompt(request.skill, request.projectContext, request.systemExtra);
  const usr = userPrompt(request.prompt, request.memoryCount, request.vaultContext, request.vaultFileCount);
  const response = await fetchWithTimeout("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: "system", content: sys },
        { role: "user", content: usr },
      ],
    }),
  });

  if (!response.ok) throw new Error(`Grok returned ${response.status}`);
  const body = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const content = body.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Grok returned an empty response");

  return {
    content,
    usage: {
      inputTokens: body.usage?.prompt_tokens ?? approxTokens(sys + usr),
      outputTokens: body.usage?.completion_tokens ?? approxTokens(content),
    },
  };
}

export async function generateWithModel(request: GenerateWithModelRequest): Promise<GenerateWithModelResult> {
  const id = request.provider.id;
  const provider = request.provider.provider;

  if (id === "claude-code" || provider === "claude-code") return generateWithClaudeCli(request);
  if (id === "codex" || provider === "codex") return generateWithCodexCli(request);
  if (id === "copilot-cli" || provider === "copilot-cli") return generateWithCopilotCli(request);
  if (id === "gemini-cli" || provider === "gemini-cli") return generateWithGeminiCli(request);
  if (id === "ollama" || provider === "ollama") return generateWithOllama(request);
  if (id === "nvidia" || provider === "nvidia") return generateWithNvidia(request);
  if (id === "anthropic" || provider === "anthropic") return generateWithAnthropic(request);
  if (id === "openai" || provider === "openai") return generateWithOpenAI(request);
  if (id === "openrouter" || provider === "openrouter") return generateWithOpenRouter(request);
  if (id === "gemini" || provider === "gemini") return generateWithGemini(request);
  if (id === "grok" || provider === "grok") return generateWithGrok(request);

  throw new Error(`${provider} generation is not implemented yet`);
}
