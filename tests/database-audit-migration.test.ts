import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("054_database_audit_fixes migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/054_database_audit_fixes.sql"),
    "utf8"
  );

  it("adds hot-path composite indexes", () => {
    expect(sql).toMatch(/idx_patients_clinic_active_lastname/);
    expect(sql).toMatch(/idx_clinical_records_clinic_created/);
    expect(sql).toMatch(/idx_patient_attachments_clinic_patient_filename/);
    expect(sql).toMatch(/idx_patient_app_share_log_clinic_patient/);
    expect(sql).toMatch(/idx_reminder_logs_clinic_created/);
    expect(sql).toMatch(/idx_payments_clinic_status_created/);
  });

  it("fixes appointment FKs to ON DELETE SET NULL", () => {
    expect(sql).toMatch(/clinical_records_appointment_id_fkey[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/reminder_logs_appointment_id_fkey[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/payments_appointment_id_fkey[\s\S]*ON DELETE SET NULL/);
  });

  it("documents deprecated PHI columns without dropping them", () => {
    expect(sql).toMatch(/COMMENT ON COLUMN patients\.medical_history/);
    expect(sql).toMatch(/DEPRECATED \(047\)/);
    expect(sql).not.toMatch(/DROP COLUMN/);
  });
});
