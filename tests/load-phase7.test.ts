import { describe, expect, it } from "vitest";

import {
  KEYSET_OFFSET_FALLBACK_MAX_PAGE,
  parseDescCursor,
} from "@/core/supabase/pagination";

describe("Phase 7 historias pagination contract", () => {
  it("does not silently clamp deep pages to page-1 data", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const src = readFileSync(
      join(process.cwd(), "src/features/historias/server/load-historias-page.ts"),
      "utf8"
    );
    expect(src).toContain('paginationMode = "cursor_required"');
    expect(src).toContain('paginationMode = "invalid_cursor"');
    expect(src).toContain("paginationError");
    // Must not reassign deep page to 1 while still fetching first-page rows
    expect(src).not.toMatch(
      /effectivePage > KEYSET_OFFSET_FALLBACK_MAX_PAGE[\s\S]{0,80}effectivePage = 1[\s\S]{0,200}\.limit\(fetchLimit\)/
    );
  });

  it("rejects malformed cursors via parseDescCursor", () => {
    expect(parseDescCursor("not-a-cursor")).toBeNull();
    expect(parseDescCursor("|only-id")).toBeNull();
    expect(parseDescCursor("2026-01-01T00:00:00.000Z|uuid")).not.toBeNull();
  });

  it("keeps shallow OFFSET fallback bounded", () => {
    expect(KEYSET_OFFSET_FALLBACK_MAX_PAGE).toBeLessThanOrEqual(3);
  });

  it("UI surfaces paginationError instead of unexpected records", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const panel = readFileSync(
      join(
        process.cwd(),
        "src/features/pacientes/components/pacientes/clinical-historias-list-panel.tsx"
      ),
      "utf8"
    );
    expect(panel).toContain("paginationError");
    expect(panel).toContain("Paginación no disponible");
  });
});

describe("Phase 7 k6 suite structure", () => {
  it("ships app/auth/spike/soak with shared libs", async () => {
    const { existsSync } = await import("node:fs");
    const { join } = await import("node:path");
    for (const f of [
      "load/k6/app-capacity.js",
      "load/k6/auth-capacity.js",
      "load/k6/spike.js",
      "load/k6/soak.js",
      "load/k6/lib/metrics.js",
      "load/k6/lib/auth.js",
      "load/k6/lib/scenarios.js",
    ]) {
      expect(existsSync(join(process.cwd(), f))).toBe(true);
    }
  });

  it("refuses anonymous app capacity and production URL", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const app = readFileSync(join(process.cwd(), "load/k6/app-capacity.js"), "utf8");
    expect(app).toContain("K6_SESSION_COOKIE required");
    expect(app).toContain("drflow.opusorg.com");
  });
});
