import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

describe("061_index_optimization migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/061_index_optimization.sql"),
    "utf8"
  );

  it("drops duplicate and redundant indexes", () => {
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_clinical_records_clinic/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_patients_document/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS idx_clinic_plugins_clinic/);
    expect(sql).toMatch(/DROP INDEX IF EXISTS patient_app_share_log_clinic_idx/);
  });

  it("adds pg_trgm indexes before patient search paths need them", () => {
    expect(sql).toMatch(/CREATE EXTENSION IF NOT EXISTS pg_trgm/);
    expect(sql).toMatch(/idx_patients_last_name_trgm/);
    expect(sql.indexOf("pg_trgm")).toBeLessThan(sql.indexOf("idx_clinical_records_appointment"));
  });

  it("indexes FK columns used in joins and orphan repair", () => {
    expect(sql).toMatch(/idx_clinical_records_appointment/);
    expect(sql).toMatch(/idx_telemedicine_sessions_appointment/);
    expect(sql).toMatch(/idx_payments_patient/);
  });

  it("adds hot-path indexes for booking and ledger queries", () => {
    expect(sql).toMatch(/idx_availability_rules_clinic_professional/);
    expect(sql).toMatch(/idx_schedule_blocks_clinic_start/);
    expect(sql).toMatch(/idx_patient_ledger_clinic_patient_entry/);
  });

  it("guards optional caja and legacy tables", () => {
    expect(sql).toMatch(/to_regclass\('public\.patient_ledger_entries'\)/);
    expect(sql).toMatch(/to_regclass\('public\.cash_charges'\)/);
    expect(sql).toMatch(/to_regclass\('public\.clinical_record_attachments'\)/);
    const ledgerGuard = sql.indexOf("to_regclass('public.patient_ledger_entries')");
    const ledgerIndex = sql.indexOf("idx_patient_ledger_clinic_patient_entry");
    expect(ledgerGuard).toBeGreaterThan(-1);
    expect(ledgerIndex).toBeGreaterThan(ledgerGuard);
  });

  it("refreshes planner statistics", () => {
    expect(sql).toMatch(/ANALYZE patients/);
  });
});
