import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const tmpVault = path.join(os.tmpdir(), `agenticos-test-vault-${Date.now()}`);

beforeAll(async () => {
  await fs.mkdir(tmpVault, { recursive: true });
  process.env.AGENTICOS_VAULT_PATH = tmpVault;
});

afterAll(async () => {
  await fs.rm(tmpVault, { recursive: true, force: true });
});

describe("vault/service path resolution", () => {
  it("rejects absolute paths", async () => {
    const { resolveVaultPath } = await import("@/lib/vault/service");
    expect(() => resolveVaultPath("C:/Windows/System32")).toThrow();
    expect(() => resolveVaultPath("/etc/hosts")).toThrow();
  });

  it("rejects ../ traversal", async () => {
    const { resolveVaultPath } = await import("@/lib/vault/service");
    expect(() => resolveVaultPath("../escape")).toThrow();
    expect(() => resolveVaultPath("raw/../../escape")).toThrow();
  });

  it("accepts plain relative paths", async () => {
    const { resolveVaultPath } = await import("@/lib/vault/service");
    const resolved = resolveVaultPath("raw/note.md");
    expect(resolved.startsWith(path.resolve(tmpVault))).toBe(true);
  });

  it("strips leading slashes", async () => {
    const { resolveVaultPath } = await import("@/lib/vault/service");
    const resolved = resolveVaultPath("/raw/note.md");
    expect(resolved.startsWith(path.resolve(tmpVault))).toBe(true);
  });
});

describe("vault/service wikilink extraction", () => {
  it("extracts simple wikilinks", async () => {
    const { extractWikiLinks } = await import("@/lib/vault/service");
    expect(extractWikiLinks("hello [[note-one]] and [[note-two]]")).toEqual(["note-one", "note-two"]);
  });

  it("dedupes wikilinks", async () => {
    const { extractWikiLinks } = await import("@/lib/vault/service");
    expect(extractWikiLinks("[[a]] [[a]] [[b]]")).toEqual(["a", "b"]);
  });

  it("respects alias pipe", async () => {
    const { extractWikiLinks } = await import("@/lib/vault/service");
    expect(extractWikiLinks("[[real-target|display name]]")).toEqual(["real-target"]);
  });
});
