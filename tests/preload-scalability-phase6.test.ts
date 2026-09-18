import { describe, expect, it } from "vitest";

import {
  checkRateLimit,
  checkRateLimitAsync,
  isDistributedRateLimitConfigured,
  resetRateLimitMemoryForTests,
  SEARCH_API_RATE_LIMIT,
} from "@/core/security/rate-limit";
import {
  descCursorNewerThanFilter,
  descCursorOlderThanFilter,
  encodeDescCursor,
  KEYSET_OFFSET_FALLBACK_MAX_PAGE,
  parseDescCursor,
} from "@/core/supabase/pagination";

describe("Phase 6 keyset pagination helpers", () => {
  it("encodes and parses stable cursors", () => {
    const raw = encodeDescCursor("2026-08-28T12:00:00.000Z", "a0000000-0000-4000-8000-000000000099");
    const parsed = parseDescCursor(raw);
    expect(parsed?.sortValue).toBe("2026-08-28T12:00:00.000Z");
    expect(parsed?.id).toBe("a0000000-0000-4000-8000-000000000099");
  });

  it("builds PostgREST older/newer filters without nested and() on primary clause", () => {
    const cursor = { sortValue: "2026-08-28T12:00:00.000Z", id: "uuid-1" };
    expect(descCursorOlderThanFilter(cursor)).toBe(
      "created_at.lt.2026-08-28T12:00:00.000Z,and(created_at.eq.2026-08-28T12:00:00.000Z,id.lt.uuid-1)"
    );
    expect(descCursorNewerThanFilter(cursor)).toContain("created_at.gt.");
  });

  it("limits OFFSET fallback to shallow pages", () => {
    expect(KEYSET_OFFSET_FALLBACK_MAX_PAGE).toBeLessThanOrEqual(5);
  });

  it("historias loader uses keyset helpers", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/historias/server/load-historias-page.ts"),
      "utf8"
    );
    expect(src).toContain("descCursorOlderThanFilter");
    expect(src).toContain("descCursorNewerThanFilter");
    expect(src).toContain("KEYSET_OFFSET_FALLBACK_MAX_PAGE");
    expect(src).toContain('paginationMode: "keyset"');
  });
});

describe("Phase 6 distributed rate limit", () => {
  it("memory backend enforces maxRequests", () => {
    resetRateLimitMemoryForTests();
    const key = `phase6-test-${Date.now()}`;
    expect(checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 })).toBe(true);
    expect(checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 })).toBe(true);
    expect(checkRateLimit(key, { windowMs: 60_000, maxRequests: 2 })).toBe(false);
  });

  it("async API returns backend metadata", async () => {
    resetRateLimitMemoryForTests();
    const result = await checkRateLimitAsync(`phase6-async-${Date.now()}`, SEARCH_API_RATE_LIMIT);
    expect(result.allowed).toBe(true);
    expect(["memory", "redis"]).toContain(result.backend);
  });

  it("documents Redis env without requiring it in unit tests", () => {
    // Unit tests must not fail when Redis is absent — fallback is intentional.
    expect(typeof isDistributedRateLimitConfigured()).toBe("boolean");
  });

  it("auth and search routes wire checkRateLimitAsync", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const login = readFileSync(join(process.cwd(), "src/app/api/auth/login/route.ts"), "utf8");
    const search = readFileSync(join(process.cwd(), "src/app/api/patients/search/route.ts"), "utf8");
    const ai = readFileSync(join(process.cwd(), "src/app/api/clinical-ai/route.ts"), "utf8");
    expect(login).toContain("checkRateLimitAsync");
    expect(search).toContain("SEARCH_API_RATE_LIMIT");
    expect(ai).toContain("AI_API_RATE_LIMIT");
  });
});

describe("Phase 6 request-scoped supabase client", () => {
  it("createClient is React.cache wrapped", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(join(process.cwd(), "src/core/supabase/server.ts"), "utf8");
    expect(src).toContain('from "react"');
    expect(src).toMatch(/export const createClient = cache\(/);
  });
});

describe("Phase 6 retention summary bounds", () => {
  it("no longer scans all created_at rows", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/configuracion/server/load-clinic-retention-summary.ts"),
      "utf8"
    );
    expect(src).toContain(".limit(1)");
    expect(src).not.toMatch(/\.order\("created_at", \{ ascending: true \}\),\s*\];/);
  });
});

describe("Phase 6 k6 script structure", () => {
  it("captures status classes and separates auth vs app modes", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const metrics = readFileSync(join(process.cwd(), "load/k6/lib/metrics.js"), "utf8");
    const app = readFileSync(join(process.cwd(), "load/k6/app-capacity.js"), "utf8");
    expect(metrics).toContain("http_2xx");
    expect(metrics).toContain("http_429");
    expect(metrics).toContain("http_5xx");
    expect(app).toContain("K6_SESSION_COOKIE");
    expect(app).toContain("STAGE");
  });
});
