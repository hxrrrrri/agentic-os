import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpRoot = path.join(os.tmpdir(), `agenticos-secrets-test-${Date.now()}`);

beforeAll(async () => {
  await fs.mkdir(path.join(tmpRoot, ".agenticos"), { recursive: true });
  process.chdir(tmpRoot);
  process.env.AGENTICOS_SECRETS_KEY = "test-passphrase-for-vitest-only";
});

afterAll(async () => {
  await fs.rm(tmpRoot, { recursive: true, force: true });
  delete process.env.AGENTICOS_SECRETS_KEY;
});

describe("secrets/store", () => {
  it("writes, reads, and deletes a secret", async () => {
    const { writeSecret, getSecret, deleteSecret, invalidateSecretsCache } = await import("@/lib/secrets/store");
    await writeSecret("DEMO_KEY", "demo-value-123", "test");
    invalidateSecretsCache();
    expect(await getSecret("DEMO_KEY")).toBe("demo-value-123");
    await deleteSecret("DEMO_KEY");
    invalidateSecretsCache();
    expect(await getSecret("DEMO_KEY")).toBeUndefined();
  });

  it("falls back to environment variable", async () => {
    const { getSecret } = await import("@/lib/secrets/store");
    process.env.ANOTHER_TEST_KEY = "from-env";
    expect(await getSecret("ANOTHER_TEST_KEY")).toBe("from-env");
    delete process.env.ANOTHER_TEST_KEY;
  });

  it("lists stored secret keys without revealing values", async () => {
    const { writeSecret, listSecretKeys, deleteSecret, invalidateSecretsCache } = await import(
      "@/lib/secrets/store"
    );
    await writeSecret("LISTED_KEY", "shh", "for listing");
    invalidateSecretsCache();
    const keys = await listSecretKeys();
    const match = keys.find((k) => k.key === "LISTED_KEY");
    expect(match).toBeDefined();
    expect(match).not.toHaveProperty("value");
    await deleteSecret("LISTED_KEY");
  });
});
