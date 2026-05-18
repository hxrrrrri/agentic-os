import { describe, it, expect, beforeAll } from "vitest";

// Force the hash fallback by ensuring no NVIDIA / OpenAI keys are visible.
beforeAll(() => {
  delete process.env.NVIDIA_API_KEY;
  delete process.env.OPENAI_API_KEY;
  // Make the encrypted-store fallback empty too.
  process.env.AGENTICOS_SECRETS_KEY = "test-key-no-real-secrets";
});

describe("memory/embeddings (hash fallback)", () => {
  it("produces a 256-dim unit vector", async () => {
    const { embed } = await import("@/lib/memory/embeddings");
    const result = await embed("hello world");
    expect(result.model).toBe("hash-256");
    expect(result.vector.length).toBe(256);
    let sum = 0;
    for (const v of result.vector) sum += v * v;
    expect(sum).toBeGreaterThan(0.98);
    expect(sum).toBeLessThan(1.02);
  });

  it("is deterministic", async () => {
    const { embed } = await import("@/lib/memory/embeddings");
    const a = await embed("the quick brown fox jumps over the lazy dog");
    const b = await embed("the quick brown fox jumps over the lazy dog");
    for (let i = 0; i < a.vector.length; i++) {
      expect(a.vector[i]).toBeCloseTo(b.vector[i], 6);
    }
  });

  it("clusters similar text", async () => {
    const { embed } = await import("@/lib/memory/embeddings");
    const a = (await embed("rocket launch lunar mission")).vector;
    const b = (await embed("space mission rocket launch")).vector;
    const c = (await embed("baking sourdough bread tips")).vector;
    const dot = (x: Float32Array, y: Float32Array) => {
      let s = 0;
      for (let i = 0; i < x.length; i++) s += x[i] * y[i];
      return s;
    };
    expect(dot(a, b)).toBeGreaterThan(dot(a, c));
  });
});
