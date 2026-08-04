import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { validateProductionEnv } from "@/lib/env.server";
import { authorizeCronRequest } from "@/lib/observability/cron-auth";

describe("validateProductionEnv", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("passes in non-production without required vars", () => {
    process.env.NODE_ENV = "development";
    delete process.env.CRON_SECRET;
    const result = validateProductionEnv({ throwOnError: false });
    expect(result.ok).toBe(true);
  });

  it("fails in production when CRON_SECRET is missing", () => {
    process.env.NODE_ENV = "production";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_test_key";
    process.env.NEXT_PUBLIC_SITE_URL = "https://drflow.example.com";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service_role_key_1234567890";
    delete process.env.CRON_SECRET;

    const result = validateProductionEnv({ throwOnError: false });
    expect(result.ok).toBe(false);
    expect(result.missing).toContain("CRON_SECRET");
  });
});

describe("authorizeCronRequest", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("allows requests when CRON_SECRET is unset in development", () => {
    process.env.NODE_ENV = "development";
    delete process.env.CRON_SECRET;
    const req = new Request("http://localhost/api/health?persist=1");
    expect(authorizeCronRequest(req)).toBe(true);
  });

  it("rejects persist in production without bearer token", () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "super-secret-cron-key";
    const req = new Request("http://localhost/api/health?persist=1");
    expect(authorizeCronRequest(req)).toBe(false);
  });

  it("accepts valid bearer token", () => {
    process.env.NODE_ENV = "production";
    process.env.CRON_SECRET = "super-secret-cron-key";
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
