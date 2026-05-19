export interface ImageGenRequest {
  prompt: string;
  /** "1024x1024" | "1792x1024" | "1024x1792" — provider-dependent. */
  size?: string;
  /** Provider preference; auto-pick if omitted. */
  provider?: "openai" | "gemini" | "stability";
  model?: string;
  /** Quality hint. */
  quality?: "low" | "standard" | "high";
  /** Negative prompt (where supported). */
  negativePrompt?: string;
  /** Number of variants. */
  n?: number;
}

export interface ImageGenResult {
  /** Raw image bytes. */
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  provider: string;
  model: string;
  width?: number;
  height?: number;
}

function pickProvider(req: ImageGenRequest): "openai" | "gemini" | "stability" {
  if (req.provider) return req.provider;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.STABILITY_API_KEY) return "stability";
  return "openai"; // default; will throw helpful error
}

async function generateWithOpenAI(req: ImageGenRequest): Promise<ImageGenResult> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY missing for image generation");
  const model = req.model ?? "gpt-image-1";
  const body: Record<string, unknown> = {
    model,
    prompt: req.prompt,
    size: req.size ?? "1024x1024",
    n: req.n ?? 1,
  };
  if (req.quality) body.quality = req.quality === "low" ? "low" : req.quality === "high" ? "high" : "standard";
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI image gen ${response.status}: ${text.slice(0, 200)}`);
  }
  const payload = (await response.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const first = payload.data?.[0];
  if (!first) throw new Error("OpenAI image gen returned no data");
  let bytes: Buffer;
  if (first.b64_json) {
    bytes = Buffer.from(first.b64_json, "base64");
  } else if (first.url) {
    const r = await fetch(first.url);
    if (!r.ok) throw new Error(`Image download failed: ${r.status}`);
    bytes = Buffer.from(await r.arrayBuffer());
  } else {
    throw new Error("OpenAI image gen returned no bytes or url");
  }
  return { bytes, mimeType: "image/png", provider: "openai", model };
}

async function generateWithGemini(req: ImageGenRequest): Promise<ImageGenResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY missing for image generation");
  const model = req.model ?? "imagen-3.0-generate-002";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${key}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      instances: [{ prompt: req.prompt }],
      parameters: { sampleCount: req.n ?? 1 },
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Gemini image gen ${response.status}: ${text.slice(0, 200)}`);
  }
  const data = (await response.json()) as {
    predictions?: Array<{ bytesBase64Encoded?: string; mimeType?: string }>;
  };
  const first = data.predictions?.[0];
  if (!first?.bytesBase64Encoded) throw new Error("Gemini image gen returned no bytes");
  const mime = first.mimeType === "image/jpeg" ? "image/jpeg" : "image/png";
  return {
    bytes: Buffer.from(first.bytesBase64Encoded, "base64"),
    mimeType: mime,
    provider: "gemini",
    model,
  };
}

async function generateWithStability(req: ImageGenRequest): Promise<ImageGenResult> {
  const key = process.env.STABILITY_API_KEY;
  if (!key) throw new Error("STABILITY_API_KEY missing for image generation");
  const model = req.model ?? "stable-image-core";
  const form = new FormData();
  form.append("prompt", req.prompt);
  if (req.negativePrompt) form.append("negative_prompt", req.negativePrompt);
  form.append("output_format", "png");
  const response = await fetch(`https://api.stability.ai/v2beta/stable-image/generate/core`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, Accept: "image/*" },
    body: form,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Stability ${response.status}: ${text.slice(0, 200)}`);
  }
  const buf = Buffer.from(await response.arrayBuffer());
  return { bytes: buf, mimeType: "image/png", provider: "stability", model };
}

export async function generateImage(req: ImageGenRequest): Promise<ImageGenResult> {
  const provider = pickProvider(req);
  switch (provider) {
    case "openai":
      return generateWithOpenAI(req);
    case "gemini":
      return generateWithGemini(req);
    case "stability":
      return generateWithStability(req);
  }
}

export function imageProviderAvailable(): { provider: string; available: boolean }[] {
  return [
    { provider: "openai", available: Boolean(process.env.OPENAI_API_KEY) },
    { provider: "gemini", available: Boolean(process.env.GEMINI_API_KEY) },
    { provider: "stability", available: Boolean(process.env.STABILITY_API_KEY) },
  ];
}
