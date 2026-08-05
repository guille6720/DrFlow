import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

describe("067_ownership_hardening migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/067_ownership_hardening.sql"),
    "utf8"
  );

  it("rejects cross-clinic patient drift instead of rewriting clinic_id", () => {
    expect(sql).toMatch(/RAISE EXCEPTION 'patient_id % does not belong to clinic_id %'/);
    expect(sql).not.toMatch(/NEW\.clinic_id := v_patient_clinic/);
  });

  it("defines shared FK ownership helpers", () => {
    expect(sql).toMatch(/assert_fk_in_clinic/);
    expect(sql).toMatch(/assert_appointment_patient_match/);
  });

  it("hardens clinical and cash SECURITY DEFINER RPCs", () => {
    expect(sql).toMatch(/create_clinical_record_atomic[\s\S]*assert_fk_in_clinic/);
    expect(sql).toMatch(/update_clinical_record_atomic[\s\S]*assert_fk_in_clinic/);
    expect(sql).toMatch(/create_cash_charge_atomic[\s\S]*assert_fk_in_clinic/);
    expect(sql).toMatch(/add_patient_ledger_entry_atomic[\s\S]*assert_fk_in_clinic/);
  });
});
