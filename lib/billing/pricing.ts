export interface ModelPricing {
  inputPerMillion: number;
  outputPerMillion: number;
}

const PRICING: Record<string, ModelPricing> = {
  "claude-opus-4-7": { inputPerMillion: 15, outputPerMillion: 75 },
  "claude-sonnet-4-6": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-sonnet-4-5": { inputPerMillion: 3, outputPerMillion: 15 },
  "claude-haiku-4-5": { inputPerMillion: 1, outputPerMillion: 5 },
  "claude-haiku-4-5-20251001": { inputPerMillion: 1, outputPerMillion: 5 },
  "claude-opus-4-1": { inputPerMillion: 15, outputPerMillion: 75 },

  "gpt-5.5": { inputPerMillion: 3, outputPerMillion: 12 },
  "gpt-5.5-mini": { inputPerMillion: 0.5, outputPerMillion: 2 },
  "gpt-5.5-nano": { inputPerMillion: 0.12, outputPerMillion: 0.5 },
  "gpt-5.5-thinking": { inputPerMillion: 4, outputPerMillion: 18 },
  "gpt-5.2": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-5.2-mini": { inputPerMillion: 0.4, outputPerMillion: 1.6 },
  "gpt-5.2-nano": { inputPerMillion: 0.1, outputPerMillion: 0.4 },
  "gpt-4.1": { inputPerMillion: 2.0, outputPerMillion: 8 },
  "o4-mini": { inputPerMillion: 1.1, outputPerMillion: 4.4 },
  "o3": { inputPerMillion: 10, outputPerMillion: 40 },
  "gpt-4o": { inputPerMillion: 2.5, outputPerMillion: 10 },
  "gpt-4o-mini": { inputPerMillion: 0.15, outputPerMillion: 0.6 },

  "gemini-2.5-pro": { inputPerMillion: 1.25, outputPerMillion: 10 },
  "gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
  "gemini-2.0-flash": { inputPerMillion: 0.1, outputPerMillion: 0.4 },

  "grok-4": { inputPerMillion: 5, outputPerMillion: 15 },
  "grok-3": { inputPerMillion: 2, outputPerMillion: 10 },

  "llama3.2:latest": { inputPerMillion: 0, outputPerMillion: 0 },
  "default-local": { inputPerMillion: 0, outputPerMillion: 0 },
  "default-cloud": { inputPerMillion: 1, outputPerMillion: 3 },
};

export function priceFor(model: string): ModelPricing {
  if (PRICING[model]) return PRICING[model];
  if (model.includes(":")) return PRICING["default-local"];
  return PRICING["default-cloud"];
}

export function computeCost(model: string, inputTokens: number, outputTokens: number): number {
  const price = priceFor(model);
  return (inputTokens / 1_000_000) * price.inputPerMillion + (outputTokens / 1_000_000) * price.outputPerMillion;
}

export function formatCost(cost: number): string {
  if (cost < 0.001) return "<$0.001";
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}
