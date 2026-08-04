import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { COVERAGE_INCLUDE } from "./coverage-scope";

describe("Phase 19 testing infrastructure", () => {
  it("defines core lib coverage scope", () => {
    expect(COVERAGE_INCLUDE.length).toBeGreaterThanOrEqual(10);
    expect(COVERAGE_INCLUDE.some((p) => p.includes("src/lib/utils"))).toBe(true);
  });

  it("includes playwright and quality gate scripts", () => {
    expect(readFileSync(resolve("playwright.config.ts"), "utf8")).toMatch(/testDir/);
    expect(readFileSync(resolve("vitest.config.ts"), "utf8")).toMatch(/coverage-scope/);
    expect(readFileSync(resolve("scripts/check-coverage.mjs"), "utf8")).toMatch(/MIN_LINES/);
    expect(readFileSync(resolve("e2e/smoke.spec.ts"), "utf8")).toMatch(/health API/);
  });

  it("documents testing in TESTING.md", () => {
    const doc = readFileSync(resolve("docs/TESTING.md"), "utf8");
    expect(doc).toMatch(/90%/);
    expect(doc).toMatch(/Playwright/);
    expect(doc).toMatch(/RLS/);
  });

  it("registers npm test scripts", async () => {
    const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
    expect(pkg.scripts["test:coverage"]).toBeTruthy();
    expect(pkg.scripts["test:e2e"]).toBeTruthy();
    expect(pkg.scripts["test:rls"]).toBeTruthy();
    expect(pkg.scripts["quality:gate"]).toBeTruthy();
    expect(pkg.scripts["check:critical-coverage"]).toBeTruthy();
  });
});

describe("enterprise RLS tables phase 13-16", () => {
  const sql =
    readFileSync(resolve("supabase/migrations/049_plugins_phase13.sql"), "utf8") +
    readFileSync(resolve("supabase/migrations/050_feature_flags_phase14.sql"), "utf8") +
    readFileSync(resolve("supabase/migrations/051_clinic_jobs_phase15.sql"), "utf8") +
    readFileSync(resolve("supabase/migrations/052_observability_phase16.sql"), "utf8");

  for (const table of [
    "clinic_plugins",
    "clinic_feature_flags",
    "clinic_jobs",
    "clinic_observability_events",
  ]) {
    it(`enables RLS on ${table}`, () => {
      expect(sql).toMatch(new RegExp(`ALTER TABLE.*${table}.*ENABLE ROW LEVEL SECURITY`, "is"));
    });
  }
});

describe("middleware public API routes", () => {
  it("bypasses auth for health and version", () => {
    const src = readFileSync(resolve("src/core/supabase/middleware.ts"), "utf8");
    expect(src).toMatch(/\/api\/health/);
    expect(src).toMatch(/\/api\/version/);
    expect(src).toMatch(/\/api\/jobs\//);
  });
});
