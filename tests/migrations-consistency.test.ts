import { readdirSync, readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

describe("migrations consistency", () => {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  it("has migration files in lexicographic order through latest commercial essential/pro", () => {
    expect(files.length).toBeGreaterThanOrEqual(138);
    expect(files[0]).toBe("001_schema.sql");
    expect(files[files.length - 1]).toBe("138_commercial_essential_pro.sql");
  });

  it("uses numeric prefix pattern without gaps through 138 (except b-suffix repairs)", () => {
    const numeric = files
      .map((f) => f.match(/^(\d+)/)?.[1])
      .filter(Boolean)
      .map(Number);
    const unique = [...new Set(numeric)].sort((a, b) => a - b);
    expect(unique[0]).toBe(1);
    expect(unique[unique.length - 1]).toBe(138);
    for (let i = 1; i <= 138; i++) {
      expect(unique).toContain(i);
    }
  });

  it("034 caja migration is idempotent", () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, "034_secretaria_caja.sql"), "utf8");
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS cash_charges/);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_cash_charges_clinic_date/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS cash_charges_all/);
    expect(sql).toMatch(/WHERE NOT EXISTS/);
    expect(sql).toMatch(/duplicate_object/);
  });

  it("004 anon policies are re-runnable", () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, "004_demo_professionals_and_public_booking.sql"), "utf8");
    expect(sql).toMatch(/DROP POLICY IF EXISTS public_booking_links_anon_select/);
    expect(sql).toMatch(/DROP POLICY IF EXISTS appointments_anon_availability_select/);
  });

  it("023 patient_app_share_log policies are re-runnable", () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, "023_patient_app_share_log.sql"), "utf8");
    expect(sql).toMatch(/DROP POLICY IF EXISTS patient_app_share_log_select/);
  });

  it("045 no longer creates duplicate clinical_records clinic index", () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, "045_security_hardening.sql"), "utf8");
    expect(sql).not.toMatch(/CREATE INDEX IF NOT EXISTS idx_clinical_records_clinic\b/);
    expect(sql).toMatch(/idx_clinical_records_clinic_created lives in 054/);
  });

  it("061 drops legacy duplicate index names", () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, "061_index_optimization.sql"), "utf8");
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_clinical_records_clinic/);
  });

  it("060 and 062 provide verification functions", () => {
    const rih = readFileSync(resolve(MIGRATIONS_DIR, "060_referential_integrity.sql"), "utf8");
    const con = readFileSync(resolve(MIGRATIONS_DIR, "062_constraint_hardening.sql"), "utf8");
    expect(rih).toMatch(/verify_referential_integrity/);
    expect(con).toMatch(/verify_constraint_integrity/);
  });

  it("marks obsolete repair migrations in comments", () => {
    const m014 = readFileSync(resolve(MIGRATIONS_DIR, "014_repair_prescription_schema.sql"), "utf8");
    const m016 = readFileSync(resolve(MIGRATIONS_DIR, "016_fix_015_booking_rpc.sql"), "utf8");
    const m041 = readFileSync(resolve(MIGRATIONS_DIR, "041_patients_insurance_plan.sql"), "utf8");
    expect(m014).toMatch(/OBSOLETA/);
    expect(m016).toMatch(/OBSOLETA/);
    expect(m041).toMatch(/REDUNDANTE/);
  });
});
