/**
 * Phase 27 — Database migrations catalog & safety tests.
 */
import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  COMPLIANCE_MIGRATIONS_132_137,
  COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN,
  evaluateDatabaseMigrationsPosture,
} from "@/core/compliance/database-migrations";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("database-migrations catalog", () => {
  it("lists 132–137 with rollback paths and no clinic damage flag", () => {
    expect(COMPLIANCE_MIGRATIONS_132_137).toHaveLength(6);
    expect(
      COMPLIANCE_MIGRATIONS_132_137.every((m) => m.damagesExistingClinicsIfAppliedCorrectly === false)
    ).toBe(true);
    expect(COMPLIANCE_MIGRATIONS_132_137.every((m) => m.legacyCompatible)).toBe(true);
    for (const m of COMPLIANCE_MIGRATIONS_132_137) {
      expect(existsSync(resolve(ROOT, m.file)), m.file).toBe(true);
      expect(existsSync(resolve(ROOT, m.rollbackFile)), m.rollbackFile).toBe(true);
    }
  });

  it("forbids production migrations in posture", () => {
    const posture = evaluateDatabaseMigrationsPosture();
    expect(posture.productionMigrationsForbidden).toBe(true);
    expect(posture.productionForbiddenBanner).toBe(COMPLIANCE_MIGRATIONS_PRODUCTION_FORBIDDEN);
    expect(posture.stagingVerifyScript).toContain("verify-compliance-migrations-staging");
  });
});

describe("fase 27 wiring (static)", () => {
  it("forward migrations are idempotent-ish (IF NOT EXISTS / OR REPLACE / DROP IF EXISTS)", () => {
    for (const m of COMPLIANCE_MIGRATIONS_132_137) {
      const sql = read(m.file);
      expect(sql.length).toBeGreaterThan(50);
      // Safety markers common to our compliance SQL
      expect(
        /CREATE OR REPLACE|IF NOT EXISTS|DROP POLICY IF EXISTS|DROP TRIGGER IF EXISTS/i.test(
          sql
        ),
        m.id
      ).toBe(true);
    }
  });

  it("137 extends canceled paid-through without mutating rows", () => {
    const sql = read("supabase/migrations/137_subscription_cancellation.sql");
    expect(sql).toContain("canceled");
    expect(sql).toContain("clinic_subscription_active");
    expect(sql).not.toMatch(/\bDELETE\b|\bTRUNCATE\b/i);
  });

  it("135 enables RLS on privacy_rights_requests", () => {
    const sql = read("supabase/migrations/135_privacy_rights_requests.sql");
    expect(sql).toContain("ENABLE ROW LEVEL SECURITY");
    expect(sql).toContain("privacy_rights_requests");
  });

  it("136 forces clinical-files private", () => {
    const sql = read("supabase/migrations/136_storage_security.sql");
    expect(sql).toContain("public = false");
  });

  it("verify script refuses production env and documents SKIP", () => {
    const script = read("scripts/verify-compliance-migrations-staging.mjs");
    expect(script).toContain("DO NOT");
    expect(script).toContain("PRODUCTION");
    expect(script).toContain("STAGING");
    expect(script).toContain("VERIFY_132_137_staging.sql");
  });

  it("package.json exposes compliance:migrations:verify-staging", () => {
    const pkg = read("package.json");
    expect(pkg).toContain("compliance:migrations:verify-staging");
  });

  it("doc states production forbidden and staging verify", () => {
    const doc = read("docs/compliance/DATABASE-MIGRATIONS-FASE-27.md");
    expect(doc).toContain("DO NOT execute production migrations");
    expect(doc).toContain("rollback");
    expect(doc).toContain("RLS");
  });
});
