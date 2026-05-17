import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["node_modules/**", ".next/**", "tests/integration/**"],
    reporters: ["default", "json"],
    outputFile: { json: "tests/.last-results.json" },
    testTimeout: 15_000,
    pool: "forks",
  },
});
