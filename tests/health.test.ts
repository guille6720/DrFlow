import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getReleasePayload } from "@/core/app-release";
import { getHealthStatus, getPublicHealthStatus } from "@/core/observability/health";
import { createTraceId } from "@/core/observability/trace-id";

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

  it("returns structured public health payload without internal fields", async () => {
    const status = await getPublicHealthStatus();

    expect(status.ok).toBe(true);
    expect(status.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(status.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(status.checks.supabase.ok).toBe(true);
    expect(status.checks.supabase.latencyMs).toBeTypeOf("number");
    expect(status.checks.memory.ok).toBe(true);
    expect(status.checks.memory).not.toHaveProperty("heapUsedMb");
    expect(status.checks).not.toHaveProperty("serviceRole");
  });

  it("returns internal health payload for admin probes", async () => {
    const status = await getHealthStatus();

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

  it("readiness public probe can include schema check without leaking serviceRole", async () => {
    const status = await getPublicHealthStatus({ includeSchema: true });
    expect(status.checks).toHaveProperty("schema");
    expect(status.checks).not.toHaveProperty("serviceRole");
    const serialized = JSON.stringify(status);
    expect(serialized).not.toMatch(/SERVICE_ROLE|eyJhbGciOi|postgres(ql)?:\/\//i);
  });
});

describe("createTraceId", () => {
  it("generates 16-char trace ids", () => {
    const id = createTraceId();
    expect(id).toHaveLength(16);
    expect(id).toMatch(/^[a-f0-9]+$/);
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
    expect(dockerfile).toMatch(/DOCKER_BUILD/);

    const healthScript = readFileSync(resolve(root, "scripts/check-health.mjs"), "utf8");
    expect(healthScript).toMatch(/\/api\/health/);
    expect(healthScript).toMatch(/\/api\/version/);
  });
});
