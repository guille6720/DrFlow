import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("060_referential_integrity migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/060_referential_integrity.sql"),
    "utf8"
  );

  it("adds prerequisite columns before referencing them", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS professional_id/);
    expect(sql).toMatch(/clinic_members_professional_id_fkey/);
    expect(sql.indexOf("ADD COLUMN IF NOT EXISTS professional_id")).toBeLessThan(
      sql.indexOf("UPDATE clinic_members cm")
    );
  });

  it("repairs clinic_id drift without deleting rows", () => {
    expect(sql).toMatch(/UPDATE %I child/);
    expect(sql).toMatch(/patient_attachments/);
    expect(sql).not.toMatch(/DELETE FROM patient_attachments/);
    expect(sql).not.toMatch(/DELETE FROM clinical_records/);
  });

  it("nulls dangling FK pointers instead of deleting parent rows", () => {
    expect(sql).toMatch(/SET appointment_id = NULL/);
    expect(sql).toMatch(/SET clinical_record_id = NULL/);
    expect(sql).toMatch(/SET template_id = NULL/);
  });

  it("adds missing template_id foreign key", () => {
    expect(sql).toMatch(/clinical_records_template_id_fkey/);
    expect(sql).toMatch(/REFERENCES clinical_templates\(id\) ON DELETE SET NULL/);
  });

  it("aligns FK ON DELETE for optional references", () => {
    expect(sql).toMatch(/prescription_drafts_clinical_record_id_fkey[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/payments_patient_id_fkey[\s\S]*ON DELETE CASCADE/);
    expect(sql).toMatch(/appointments_rescheduled_from_fkey[\s\S]*ON DELETE SET NULL/);
    expect(sql).toMatch(/public_booking_links_professional_id_fkey[\s\S]*ON DELETE SET NULL/);
  });

  it("guards caja FK fixes when tables exist", () => {
    expect(sql).toMatch(/to_regclass\('public\.cash_charges'\)/);
  });

  it("installs tenant consistency triggers", () => {
    expect(sql).toMatch(/enforce_patient_clinic_consistency/);
    expect(sql).toMatch(/enforce_clinic_member_professional/);
    expect(sql).toMatch(/trg_%I_patient_clinic/);
  });

  it("provides verify_referential_integrity function", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION verify_referential_integrity/);
    expect(sql).toMatch(/patient_clinic_mismatch/);
    expect(sql).toMatch(/clinical_record_orphan_appointment/);
  });

  it("is idempotent (DROP IF EXISTS before ADD)", () => {
    const drops = sql.match(/DROP CONSTRAINT IF EXISTS/g) ?? [];
    expect(drops.length).toBeGreaterThanOrEqual(8);
  });
});
