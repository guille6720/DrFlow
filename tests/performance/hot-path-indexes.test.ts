import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const migrationsDir = join(process.cwd(), "supabase/migrations");

function readMigration(name: string): string {
  return readFileSync(join(migrationsDir, name), "utf8");
}

const catalog = [
  readMigration("001_schema.sql"),
  readMigration("013_electronic_prescriptions_argentina.sql"),
  readMigration("046_performance_indexes.sql"),
  readMigration("054_database_audit_fixes.sql"),
  readMigration("061_index_optimization.sql"),
  readMigration("088_database_audit_indexes.sql"),
  readMigration("111_clinical_record_dx_tx_normalization.sql"),
].join("\n");

describe("Fase 8 hot-path indexes already exist", () => {
  it("covers clinic_id + created_at DESC", () => {
    expect(catalog).toMatch(/idx_clinical_records_clinic_created[\s\S]*clinic_id, created_at DESC/);
    expect(catalog).toMatch(
      /idx_clinical_records_clinic_patient_created[\s\S]*clinic_id, patient_id, created_at DESC/
    );
    expect(catalog).toMatch(
      /idx_patient_attachments_clinic_patient_created[\s\S]*clinic_id, patient_id, created_at DESC/
    );
  });

  it("covers patient_id + created_at DESC (tenant-prefixed)", () => {
    expect(catalog).toMatch(/idx_prescription_drafts_patient[\s\S]*patient_id, created_at DESC/);
    expect(catalog).toMatch(
      /idx_medical_orders_clinic_patient_issued[\s\S]*clinic_id, patient_id, issued_at DESC/
    );
    expect(catalog).toMatch(/idx_crd_clinic_patient[\s\S]*clinic_id, patient_id, created_at DESC/);
  });

  it("covers clinic_id + status", () => {
    expect(catalog).toMatch(/idx_appointments_status[\s\S]*clinic_id, status/);
    expect(catalog).toMatch(
      /idx_prescription_drafts_clinic_status[\s\S]*clinic_id, status, created_at DESC/
    );
    expect(catalog).toMatch(
      /idx_appointments_clinic_patient_status_start[\s\S]*clinic_id, patient_id, status, start_at DESC/
    );
    expect(catalog).toMatch(/idx_ppl_clinic_patient_status/);
  });

  it("does not add a duplicate hot-path migration", () => {
    const files = readdirSync(migrationsDir);
    expect(files.filter((name) => /performance_hot_paths/i.test(name))).toEqual([]);
    expect(catalog).toMatch(/idx_patients_last_name_trgm/);
    expect(catalog).toMatch(/idx_clinical_records_diagnosis_trgm/);
  });
});
