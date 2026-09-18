import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relative: string): string {
  return readFileSync(join(root, relative), "utf8");
}

describe("Phase 3 tenant isolation staging tooling", () => {
  const scripts = [
    "scripts/phase3-seed-staging-tenant-fixtures.mjs",
    "scripts/configure-staging-tenant-b-account.mjs",
    "scripts/qa-staging-tenant-isolation.mjs",
    "scripts/lib/tenant-isolation-env.mjs",
  ];

  it.each(scripts)("ships %s", (path) => {
    expect(existsSync(join(root, path))).toBe(true);
  });

  it("qa probe script covers JWT cross-clinic and storage scenarios", () => {
    const src = read("scripts/qa-staging-tenant-isolation.mjs");
    expect(src).toMatch(/signInWithPassword/);
    expect(src).toMatch(/cross-clinic/);
    expect(src).toMatch(/PATIENT_MISMATCH/);
    expect(src).toMatch(/createSignedUrl/);
    expect(src).toMatch(/clinical_record_audit/);
    expect(src).toMatch(/p0_leak/);
  });

  it("integration test uses live JWT when DRFLOW_RLS_INTEGRATION=1", () => {
    const src = read("tests/cross-tenant-rls.integration.test.ts");
    expect(src).toMatch(/DRFLOW_RLS_INTEGRATION/);
    expect(src).toMatch(/signInWithPassword/);
    expect(src).not.toMatch(/Impersonación: JWT de usuario real requiere password/);
  });

  it("Playwright tenant isolation spec covers rapid A/B and cross-clinic URL", () => {
    const src = read("e2e/tenant-isolation-staging.spec.ts");
    expect(src).toMatch(/rapid A→B→A→B/);
    expect(src).toMatch(/cross-clinic/);
    expect(src).toMatch(/assertNoForbiddenFlash/);
  });

  it("CI workflow separates static RLS from staging live probes", () => {
    const ci = read(".github/workflows/ci.yml");
    const staging = read(".github/workflows/staging-tenant-isolation.yml");
    expect(ci).toMatch(/test:rls:static/);
    expect(staging).toMatch(/workflow_dispatch/);
    expect(staging).toMatch(/qa-staging-tenant-isolation/);
    expect(staging).toMatch(/Refusing production Supabase URL/);
  });
});
