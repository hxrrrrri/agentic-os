import { describe, it, expect } from "vitest";
import { parseToolCalls } from "@/lib/agent/tool-loop";

describe("agent/tool-loop parseToolCalls", () => {
  it("parses pure JSON form", () => {
    const text = [
      "Some preamble",
      "```toolcall",
      '{"name": "render_carousel", "args": {"title": "X", "slides": []}}',
      "```",
    ].join("\n");
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("render_carousel");
    expect(calls[0].args).toMatchObject({ title: "X" });
  });

  it("parses name-then-JSON form", () => {
    const text = [
      "```toolcall",
      "render_carousel",
      '{"title": "Y", "slides": [{"title": "a", "body": "b"}]}',
      "```",
    ].join("\n");
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("render_carousel");
    expect((calls[0].args as { slides: unknown[] }).slides).toHaveLength(1);
  });

  it("repairs trailing commas", () => {
    const text = [
      "```toolcall",
      "vault_write_note",
      '{"folder": "raw", "title": "T", "body": "B",}',
      "```",
    ].join("\n");
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("vault_write_note");
    expect(calls[0].args).toMatchObject({ folder: "raw", title: "T", body: "B" });
  });

  it("parses multiple calls in one model turn", () => {
    const text = [
      "first call:",
      "```toolcall",
      "render_thumbnail",
      '{"title": "Hero"}',
      "```",
      "second call:",
      "```toolcall",
      '{"name": "vault_write_note", "args": {"folder": "raw", "title": "n", "body": "x"}}',
      "```",
    ].join("\n");
    const calls = parseToolCalls(text);
    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe("render_thumbnail");
    expect(calls[1].name).toBe("vault_write_note");
  });

  it("silently skips malformed blocks", () => {
    const text = [
      "```toolcall",
      "not_a_real_block",
      "this is not json at all }}",
      "```",
      "```toolcall",
      "render_thumbnail",
      '{"title": "OK"}',
      "```",
    ].join("\n");
    let calls: ReturnType<typeof parseToolCalls>;
    expect(() => {
      calls = parseToolCalls(text);
    }).not.toThrow();
    // Only the well-formed second block survives.
    expect(calls!.length).toBe(1);
    expect(calls![0].name).toBe("render_thumbnail");
  });
});
