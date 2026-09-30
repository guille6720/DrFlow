import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EnvironmentBadge, environmentBadgeLabel } from "@/core/components/layout/environment-badge";
import { KNOWN_SUPABASE_PROJECTS } from "@/core/environment/isolation.mjs";

describe("non-production badge (Phase 1L I–K)", () => {
  afterEach(cleanup);

  it("I: hidden in production (and development)", () => {
    expect(environmentBadgeLabel("production")).toBeNull();
    expect(environmentBadgeLabel("development")).toBeNull();
    const { container } = render(<EnvironmentBadge environment="production" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("J: shows STAGING in staging", () => {
    render(<EnvironmentBadge environment="staging" />);
    expect(screen.getByTestId("environment-badge")).toHaveTextContent("STAGING");
  });

  it("K: shows FISCALIZACIÓN in fiscalization, without refs", () => {
    render(<EnvironmentBadge environment="fiscalization" />);
    const badge = screen.getByTestId("environment-badge");
    expect(badge).toHaveTextContent("FISCALIZACIÓN");
    expect(badge.outerHTML).not.toMatch(/supabase|[a-z0-9]{20}/);
  });
});

describe("health endpoint (Phase 1L L)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  const SECRET = "sb_secret_super_sensitive_value";
  const PUBLISHABLE = "sb_publishable_test_value";

  async function health() {
    const { getPublicHealthStatus } = await import("@/core/observability/health");
    return getPublicHealthStatus();
  }

  it("L: reports status/environment/version/commit/database and never secrets or refs", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${KNOWN_SUPABASE_PROJECTS.staging}.supabase.co`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE);
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", SECRET);
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abcdef1234567890abcdef1234567890abcdef12");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 200 })));

    const status = await health();
    expect(status).toMatchObject({
      status: "ok",
      environment: "staging",
      commit: "abcdef1234567890abcdef1234567890abcdef12",
      database: "connected",
      environmentIsolation: { ok: true, errors: [] },
    });
    expect(status.version).toBeTruthy();
    const text = JSON.stringify(status);
    for (const forbidden of [SECRET, PUBLISHABLE, KNOWN_SUPABASE_PROJECTS.staging, KNOWN_SUPABASE_PROJECTS.production, "supabase.co"]) {
      expect(text).not.toContain(forbidden);
    }
  });

  it("locked environments report codes and never probe the rejected database", async () => {
    vi.stubEnv("APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${KNOWN_SUPABASE_PROJECTS.production}.supabase.co`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", PUBLISHABLE);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const status = await health();
    expect(status).toMatchObject({ ok: false, status: "locked", database: "blocked_by_isolation" });
    expect(status.environmentIsolation.errors).toContain("NON_PRODUCTION_USES_PRODUCTION_DB");
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(JSON.stringify(status)).not.toContain(KNOWN_SUPABASE_PROJECTS.production);
  });
});
