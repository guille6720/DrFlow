import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { isValidPublicSiteUrl, normalizePublicUrl } from "@/core/supabase/env";

const ROOT = process.cwd();

function readMigration(name: string): string {
  return readFileSync(resolve(ROOT, "supabase/migrations", name), "utf8");
}

describe("155_clinical_record_audit_patient_ownership migration", () => {
  const sql = readMigration("155_clinical_record_audit_patient_ownership.sql");

  it("backfills null audit patient_id from clinical_records", () => {
    expect(sql).toMatch(/UPDATE clinical_record_audit a[\s\S]*SET patient_id = r\.patient_id/);
    expect(sql).toMatch(/a\.patient_id IS NULL/);
    expect(sql).toMatch(/a\.clinic_id = r\.clinic_id/);
  });

  it("derives patient_id from parent clinical_records on INSERT", () => {
    expect(sql).toMatch(/enforce_audit_insert_integrity/);
    expect(sql).toMatch(/NEW\.patient_id := v_record_patient/);
    expect(sql).toMatch(/AUDIT_CLINIC_MISMATCH/);
  });

  it("sets patient_id NOT NULL after backfill", () => {
    expect(sql).toMatch(/ALTER COLUMN patient_id SET NOT NULL/);
  });
});

describe("public site URL validation", () => {
  it("rejects placeholder and invalid URLs", () => {
    expect(isValidPublicSiteUrl("https://[SENSITIVE]")).toBe(false);
    expect(isValidPublicSiteUrl("not-a-url")).toBe(false);
    expect(isValidPublicSiteUrl("https://drflow.example.test")).toBe(true);
  });

  it("normalizes bare hostnames", () => {
    expect(normalizePublicUrl("staging.example.com")).toBe("https://staging.example.com");
  });
});
