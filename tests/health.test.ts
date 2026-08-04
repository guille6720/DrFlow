import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getHealthStatus } from "@/lib/observability/health";
import { getReleasePayload } from "@/lib/app-release";

describe("getHealthStatus", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      })
    );
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test-project.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "test-publishable-key";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
  });

  it("returns structured health payload", async () => {
    const status = await getHealthStatus();

    expect(status.ok).toBe(true);
    expect(status.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(status.checks.supabase.ok).toBe(true);
    expect(status.checks.supabase.latencyMs).toBeTypeOf("number");
    expect(status.checks.memory.heapUsedMb).toBeGreaterThan(0);
    expect(status.checks.memory.heapTotalMb).toBeGreaterThan(0);
    expect(status.checks.serviceRole).toHaveProperty("configured");
  });

  it("marks health degraded when supabase is unreachable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network down"))
    );

    const status = await getHealthStatus();
    expect(status.ok).toBe(false);
    expect(status.checks.supabase.ok).toBe(false);
    expect(status.checks.supabase.error).toBe("Network down");
  });
});

describe("release payload", () => {
  it("exposes version metadata for /api/version", () => {
    const payload = getReleasePayload();
    expect(payload.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(payload.title).toBeTruthy();
    expect(payload.highlights.length).toBeGreaterThan(0);
  });
});

describe("production scripts", () => {
  it("includes Dockerfile and health probe script", async () => {
    const { readFileSync, existsSync } = await import("fs");
    const { resolve } = await import("path");
    const root = process.cwd();

    expect(existsSync(resolve(root, "Dockerfile"))).toBe(true);
    expect(existsSync(resolve(root, "docker-compose.yml"))).toBe(true);

    const dockerfile = readFileSync(resolve(root, "Dockerfile"), "utf8");
    expect(dockerfile).toMatch(/standalone/);

    const healthScript = readFileSync(resolve(root, "scripts/check-health.mjs"), "utf8");
    expect(healthScript).toMatch(/\/api\/health/);
    expect(healthScript).toMatch(/\/api\/version/);
  });
});
