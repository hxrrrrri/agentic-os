import type { Integration } from "@/types";
import { listIntegrations } from "@/lib/db/repositories";

export interface IntegrationAdapter {
  id: string;
  read(signal: string): Promise<Record<string, unknown>>;
  draft?(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
  write?(payload: Record<string, unknown>): Promise<Record<string, unknown>>;
}

function mockAdapter(id: string): IntegrationAdapter {
  return {
    id,
    async read(signal) {
      return {
        mode: "mock",
        integration: id,
        signal,
        result: `Mock ${id} data loaded for ${signal}. Configure credentials to enable real adapter execution.`,
      };
    },
    async draft(payload) {
      return { mode: "mock", integration: id, draft: payload };
    },
  };
}

export async function getIntegrationAdapters() {
  const integrations = await listIntegrations();
  return new Map<string, IntegrationAdapter>(
    integrations.map((integration: Integration) => [integration.id, mockAdapter(integration.id)]),
  );
}
