import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = process.cwd();

describe("environment secrets audit", () => {
  it("server-only modules guard admin and LLM secrets", () => {
    const modules = [
      "src/core/supabase/admin.ts",
      "src/core/env.server.ts",
      "src/lib/utils/clinical-ai-llm-provider.server.ts",
    ];

    for (const rel of modules) {
      const content = readFileSync(resolve(ROOT, rel), "utf8");
      expect(content).toContain('import "server-only"');
      expect(content).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']{20,}["']/);
    }
  });

  it(".env.local is gitignored", () => {
    const gitignore = readFileSync(resolve(ROOT, ".gitignore"), "utf8");
    expect(gitignore).toMatch(/\.env\*/);
  });

  it(".env.example has empty server secret placeholders", () => {
    const example = readFileSync(resolve(ROOT, ".env.example"), "utf8");
    expect(example).toContain("SUPABASE_SERVICE_ROLE_KEY=");
    expect(example).not.toMatch(/SUPABASE_SERVICE_ROLE_KEY=eyJ/);
    expect(example).not.toMatch(/CRON_SECRET=[^#\n]{8,}/);
  });

  it("public health probe omits service role metadata", async () => {
    const { getPublicHealthStatus } = await import("@/core/observability/health");
    const status = await getPublicHealthStatus();
    expect(status.checks).not.toHaveProperty("serviceRole");
    expect(status.checks.memory).not.toHaveProperty("heapUsedMb");
  });
});
