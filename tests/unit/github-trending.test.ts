import { describe, it, expect } from "vitest";
import { fetchGhTrending } from "@/lib/integrations/github-trending";

describe("github-trending fetcher", () => {
  it("returns null or an array (never throws)", async () => {
    const res = await fetchGhTrending(3);
    if (res !== null) {
      expect(Array.isArray(res)).toBe(true);
      expect(res.length).toBeLessThanOrEqual(3);
      for (const repo of res) {
        expect(typeof repo.name).toBe("string");
        expect(repo.name.length).toBeGreaterThan(0);
        expect(typeof repo.rank).toBe("number");
      }
    }
  });
});
