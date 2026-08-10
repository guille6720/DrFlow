import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/091_performance_audit_group1.sql"),
  "utf8"
);

describe("091 performance audit group1 migration", () => {
  it("extends search_patients_for_clinic with offset and email", () => {
    expect(sql).toMatch(/search_patients_for_clinic[\s\S]*p_offset INT DEFAULT 0/);
    expect(sql).toMatch(/p\.email/);
    expect(sql).toMatch(/OFFSET v_offset/);
  });

  it("adds count_patients_for_clinic_search RPC", () => {
    expect(sql).toMatch(/count_patients_for_clinic_search/);
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.count_patients_for_clinic_search/);
  });

  it("guards cash closure RPC when cash_charges table exists", () => {
    expect(sql).toMatch(/to_regclass\('public\.cash_charges'\)/);
    expect(sql).toMatch(/summarize_collected_cash_charges_for_closure/);
    expect(sql).toMatch(/patient_count/);
    expect(sql).toMatch(/consultation_count/);
  });
});
