import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/088_database_audit_indexes.sql"),
  "utf8"
);

describe("088_database_audit_indexes migration", () => {
  it("adds PAMI and pathology search indexes", () => {
    expect(sql).toMatch(/idx_patients_clinic_pami_active/);
    expect(sql).toMatch(/idx_clinical_records_diagnosis_trgm/);
    expect(sql).toMatch(/idx_clinical_records_chief_complaint_trgm/);
  });

  it("adds vademecum trgm indexes", () => {
    expect(sql).toMatch(/idx_pami_vademecum_brand_trgm/);
    expect(sql).toMatch(/idx_pami_vademecum_ingredient_trgm/);
  });

  it("indexes upcoming appointments with clinic_id prefix", () => {
    expect(sql).toMatch(/idx_appointments_clinic_upcoming_active/);
    expect(sql).toMatch(/clinic_id, start_at/);
  });
});
