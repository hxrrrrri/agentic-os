import { describe, it, expect } from "vitest";
import { slugify, titleFromPrompt, formatMs, createId } from "@/lib/utils";

describe("utils/slugify", () => {
  it("lowercases and dashes", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  it("strips special chars", () => {
    expect(slugify("Hello, World! 2024")).toBe("hello-world-2024");
  });

  it("trims surrounding dashes", () => {
    expect(slugify("!!! foo bar !!!")).toBe("foo-bar");
  });

  it("truncates to 72 chars", () => {
    expect(slugify("a".repeat(200)).length).toBeLessThanOrEqual(72);
  });
});

describe("utils/titleFromPrompt", () => {
  it("collapses whitespace", () => {
    expect(titleFromPrompt("hello   world  ")).toBe("hello world");
  });

  it("truncates over 58 chars", () => {
    const long = "x".repeat(80);
    expect(titleFromPrompt(long).endsWith("...")).toBe(true);
  });

  it("handles empty input", () => {
    expect(titleFromPrompt("")).toBe("Untitled run");
  });
});

describe("utils/formatMs", () => {
  it("formats sub-second", () => {
    expect(formatMs(500)).toBe("500ms");
  });

  it("formats seconds", () => {
    expect(formatMs(3000)).toBe("3s");
  });

  it("formats minutes", () => {
    expect(formatMs(125_000)).toBe("2m 5s");
  });

  it("handles 0/undefined", () => {
    expect(formatMs(0)).toBe("0s");
    expect(formatMs()).toBe("0s");
  });
});

describe("utils/createId", () => {
  it("includes the prefix", () => {
    expect(createId("run").startsWith("run_")).toBe(true);
  });

  it("produces unique ids", () => {
    const set = new Set(Array.from({ length: 50 }, () => createId("x")));
    expect(set.size).toBe(50);
  });
});
