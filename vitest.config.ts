import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";
import { COVERAGE_EXCLUDE, COVERAGE_INCLUDE } from "./tests/coverage-scope";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: COVERAGE_INCLUDE,
      exclude: COVERAGE_EXCLUDE,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
