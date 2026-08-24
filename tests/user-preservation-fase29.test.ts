/**
 * Phase 29 — Do not break current users (static + catalog).
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  COMPLIANCE_FORWARD_MIGRATIONS_PRESERVATION,
  evaluateUserPreservationPosture,
  findForbiddenBreakageInSql,
  FORBIDDEN_USER_BREAKAGE,
} from "@/core/compliance/user-preservation";

const ROOT = process.cwd();

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("user-preservation policy", () => {
  it("lists six forbidden operations without explicit approval", () => {
    expect(FORBIDDEN_USER_BREAKAGE.map((f) => f.id)).toEqual([
      "delete_clinics",
      "delete_patients",
      "reset_subscriptions",
      "change_owners",
      "remove_legitimate_permissions",
      "destroy_clinical_records",
    ]);
    const posture = evaluateUserPreservationPosture();
    expect(posture.existingClinicsMustRetainAccess).toBe(true);
    expect(posture.productionDestructiveMigrationsForbidden).toBe(true);
  });

  it("compliance forward migrations 132–137 contain no forbidden breakage smells", () => {
    for (const file of COMPLIANCE_FORWARD_MIGRATIONS_PRESERVATION) {
      const sql = read(file);
      expect(findForbiddenBreakageInSql(sql), file).toEqual([]);
    }
  });

  it("does not DROP core tenant tables in 132–137", () => {
    for (const file of COMPLIANCE_FORWARD_MIGRATIONS_PRESERVATION) {
      const sql = read(file).replace(/--[^\n]*/g, "\n");
      expect(sql).not.toMatch(
        /\bDROP\s+TABLE\s+(IF\s+EXISTS\s+)?(public\.)?(clinics|patients|clinical_records|clinic_subscriptions|clinic_members)\b/i
      );
    }
  });
});

describe("USER-PRESERVATION-FASE-29.md", () => {
  it("states forbidden actions and staging verify", () => {
    const doc = read("docs/compliance/USER-PRESERVATION-FASE-29.md");
    expect(doc).toMatch(/delete clinics|Delete clinics/i);
    expect(doc).toMatch(/delete patients|Delete patients/i);
    expect(doc).toMatch(/Reset subscriptions/i);
    expect(doc).toMatch(/clinical records|HC/i);
    expect(doc).toContain("VERIFY_USER_PRESERVATION_staging.sql");
    expect(doc).toMatch(/aprobación explícita/i);
  });
});
