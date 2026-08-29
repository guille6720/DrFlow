import {readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("Phase 7B clinical write load suite", () => {
  it("documents authoritative persist path", () => {
    const report = readFileSync(
      join(process.cwd(), "docs/production-readiness/PHASE-7B-CLINICAL-WRITE-LOAD.md"),
      "utf8"
    );
    expect(report).toContain("/api/clinical-records/persist");
    expect(report).toContain("update_clinical_record_atomic");
    expect(report).toContain("clinical_record_audit");
    expect(report).toContain("BL-P0-2");
  });

  it("ships write capacity and contention k6 scripts", () => {
    const capacity = readFileSync(join(process.cwd(), "load/k6/clinical-write-capacity.js"), "utf8");
    const contention = readFileSync(join(process.cwd(), "load/k6/clinical-write-contention.js"), "utf8");
    const scenarios = readFileSync(join(process.cwd(), "load/k6/lib/write-scenarios.js"), "utf8");
    const metrics = readFileSync(join(process.cwd(), "load/k6/lib/write-metrics.js"), "utf8");
    expect(capacity).toContain("K6_SESSION_POOL_FILE");
    expect(capacity).toContain("drflow.opusorg.com");
    expect(contention).toContain("CONTENTION_VUS");
    expect(scenarios).toContain("/api/clinical-records/persist");
    expect(scenarios).toContain("Origin");
    expect(metrics).toContain("clinical_write_success_rate");
    expect(metrics).toContain("clinical_write_readback_mismatch");
  });

  it("excludes regulated prescription issuance from write mix", () => {
    const scenarios = readFileSync(join(process.cwd(), "load/k6/lib/write-scenarios.js"), "utf8");
    expect(scenarios).toMatch(/prescription/i);
    expect(scenarios).toContain("was prescription slot");
  });

  it("seed and mint scripts refuse production", () => {
    const seed = readFileSync(join(process.cwd(), "scripts/phase7b-seed-write-fixtures.mjs"), "utf8");
    const mint = readFileSync(join(process.cwd(), "scripts/phase7b-mint-session-pool.mjs"), "utf8");
    expect(seed).toContain("PRODUCTION_REF");
    expect(seed).toContain("LOADTEST_CLINIC_");
    expect(mint).toContain("NEVER prints cookie");
    expect(mint).toContain("signInWithPassword");
  });

  it("session pool path is gitignored", () => {
    const gi = readFileSync(join(process.cwd(), ".gitignore"), "utf8");
    expect(gi).toContain("e2e/.phase7b-session-pool.json");
  });
});
