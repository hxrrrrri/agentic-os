import { describe, it, expect } from "vitest";
import { detectRisk, requiresApproval } from "@/lib/permissions/policy";

describe("permissions/policy", () => {
  describe("detectRisk", () => {
    it("flags refund as critical", () => {
      expect(detectRisk("refund a customer")).toBe("critical");
    });

    it("flags delete as critical", () => {
      expect(detectRisk("delete vault file")).toBe("critical");
    });

    it("flags push as high", () => {
      expect(detectRisk("push branch to origin")).toBe("high");
    });

    it("flags publish as high", () => {
      expect(detectRisk("publish blog post")).toBe("high");
    });

    it("flags draft/move/update/create as medium", () => {
      expect(detectRisk("draft an email")).toBe("medium");
      expect(detectRisk("move file")).toBe("medium");
      expect(detectRisk("update record")).toBe("medium");
      expect(detectRisk("create note")).toBe("medium");
    });

    it("defaults to low", () => {
      expect(detectRisk("read recent notes")).toBe("low");
    });
  });

  describe("requiresApproval", () => {
    it("disabled always requires approval", () => {
      expect(requiresApproval("low", "disabled")).toBe(true);
    });

    it("read-only requires approval at medium+", () => {
      expect(requiresApproval("low", "read-only")).toBe(false);
      expect(requiresApproval("medium", "read-only")).toBe(true);
    });

    it("draft-only requires approval at high+", () => {
      expect(requiresApproval("medium", "draft-only")).toBe(false);
      expect(requiresApproval("high", "draft-only")).toBe(true);
    });

    it("auto-execute-allowed still requires approval for high+", () => {
      expect(requiresApproval("medium", "auto-execute-allowed")).toBe(false);
      expect(requiresApproval("critical", "auto-execute-allowed")).toBe(true);
    });
  });
});
