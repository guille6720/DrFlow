import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("058 RLS audit hardening migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/058_rls_audit_hardening.sql"),
    "utf8"
  );

  it("defines is_clinic_staff helper with auth-scoped roles", () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION is_clinic_staff/);
    expect(sql).toMatch(/user_role_in_clinic\(p_clinic_id\)/);
    expect(sql).toMatch(/clinic_admin', 'doctor', 'secretary/);
  });

  it("restricts clinic_jobs SELECT to staff roles", () => {
    expect(sql).toMatch(/clinic_jobs_select[\s\S]*clinic_admin', 'doctor', 'secretary/);
  });

  it("restricts observability SELECT to clinic_admin", () => {
    expect(sql).toMatch(/observability_events_select[\s\S]*clinic_admin/);
    expect(sql).not.toMatch(/observability_events_insert[\s\S]*clinic_id IS NULL/);
  });

  it("splits telemedicine_sessions from permissive ALL", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS telemedicine_sessions_all/);
    expect(sql).toMatch(/telemedicine_sessions_select[\s\S]*can_view_clinical/);
    expect(sql).toMatch(/telemedicine_sessions_insert[\s\S]*is_doctor_in_clinic/);
  });

  it("aligns payments with can_manage_clinic", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS payments_all/);
    expect(sql).toMatch(/payments_select[\s\S]*can_manage_clinic/);
  });

  it("replaces consent_records_all with read-only clinical policy", () => {
    expect(sql).toMatch(/DROP POLICY IF EXISTS consent_records_all/);
    expect(sql).toMatch(/consent_records_select[\s\S]*can_view_clinical/);
    expect(sql).not.toMatch(/consent_records_insert/);
  });

  it("hardens availability_rules and schedule_blocks writes", () => {
    expect(sql).toMatch(/availability_rules_insert[\s\S]*is_clinic_staff/);
    expect(sql).toMatch(/schedule_blocks_insert[\s\S]*is_clinic_staff/);
  });
});
