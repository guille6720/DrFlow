import { describe, expect, it, afterEach, vi } from "vitest";
import { validateProductionEnv } from "@/core/env.server";
import { authorizeCronRequest } from "@/core/observability/cron-auth";

describe("validateProductionEnv", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes in non-production without required vars", () => {
    vi.stubEnv("NODE_ENV", "development");
    const result = validateProductionEnv({ throwOnError: false });
    expect(result.ok).toBe(true);
  });

  it("fails in production when CRON_SECRET is missing", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_key");
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://drflow.example.com");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service_role_key_1234567890");
    vi.stubEnv("CRON_SECRET", "");

    const result = validateProductionEnv({ throwOnError: false });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("CRON_SECRET");
  });
});

describe("authorizeCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows requests when CRON_SECRET is unset in development", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("CRON_SECRET", "");
    const req = new Request("http://localhost/api/health?persist=1");
    expect(authorizeCronRequest(req)).toBe(true);
  });

  it("rejects persist in production without bearer token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "super-secret-cron-key");
    const req = new Request("http://localhost/api/health?persist=1");
    expect(authorizeCronRequest(req)).toBe(false);
  });

  it("accepts valid bearer token", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("CRON_SECRET", "super-secret-cron-key");
    const req = new Request("http://localhost/api/health?persist=1", {
      headers: { authorization: "Bearer super-secret-cron-key" },
    });
    expect(authorizeCronRequest(req)).toBe(true);
  });
});

describe("enterprise deployment artifacts", () => {
  it("includes production readiness and DR documentation", async () => {
    const { existsSync } = await import("fs");
    const { resolve } = await import("path");
    const root = process.cwd();

    expect(existsSync(resolve(root, "PRODUCTION_READINESS_REPORT.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/DISASTER_RECOVERY.md"))).toBe(true);
    expect(existsSync(resolve(root, "src/lib/env.server.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/app/api/health/live/route.ts"))).toBe(true);
    expect(existsSync(resolve(root, "src/app/api/health/ready/route.ts"))).toBe(true);
  });
});

describe("enterprise quality gate artifacts", () => {
  it("includes quality gate scripts and documentation", async () => {
    const { existsSync } = await import("fs");
    const { resolve } = await import("path");
    const root = process.cwd();

    expect(existsSync(resolve(root, "QUALITY_AUDIT.md"))).toBe(true);
    expect(existsSync(resolve(root, "QUALITY_REPORT.md"))).toBe(true);
    expect(existsSync(resolve(root, "SECURITY_GATE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/DEFINITION_OF_DONE.md"))).toBe(true);
    expect(existsSync(resolve(root, "docs/ENGINEERING_STANDARDS.md"))).toBe(true);
    expect(existsSync(resolve(root, ".github/pull_request_template.md"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/quality-gate.mjs"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/code-quality-gate.mjs"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/security-gate.mjs"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/architecture-gate.mjs"))).toBe(true);
    expect(existsSync(resolve(root, "scripts/performance-gate.mjs"))).toBe(true);
  });
});
