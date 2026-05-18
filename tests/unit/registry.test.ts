import { describe, it, expect } from "vitest";
import { INTEGRATIONS, findSpec } from "@/lib/integrations/registry";

describe("integrations/registry", () => {
  it("every spec has a unique id", () => {
    const ids = new Set<string>();
    for (const s of INTEGRATIONS) {
      expect(ids.has(s.id), `duplicate id ${s.id}`).toBe(false);
      ids.add(s.id);
    }
    expect(ids.size).toBe(INTEGRATIONS.length);
  });

  it("every required field has uppercase env-style key", () => {
    for (const spec of INTEGRATIONS) {
      for (const field of [...spec.fields, ...(spec.optionalFields ?? [])]) {
        expect(field.key, `${spec.id}.${field.label}`).toMatch(/^[A-Z0-9_]+$/);
      }
    }
  });

  it("findSpec returns by id", () => {
    expect(findSpec("github")?.name).toBe("GitHub");
    expect(findSpec("not-a-thing")).toBeUndefined();
  });

  it("every test endpoint path is local", () => {
    for (const spec of INTEGRATIONS) {
      if (!spec.testEndpoint) continue;
      expect(spec.testEndpoint.path.startsWith("/api/")).toBe(true);
    }
  });
});
