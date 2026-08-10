import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/087_patient_search_optimization.sql"),
  "utf8"
);

describe("087_patient_search_optimization migration", () => {
  it("defines patient search RPC", () => {
    expect(sql).toMatch(/search_patients_for_clinic/);
    expect(sql).toMatch(/normalize_patient_document/);
    expect(sql).toMatch(/normalize_patient_phone/);
  });

  it("adds targeted DNI and phone indexes", () => {
    expect(sql).toMatch(/idx_patients_clinic_document_digits/);
    expect(sql).toMatch(/idx_patients_phone_trgm/);
  });

  it("grants execute to authenticated", () => {
    expect(sql).toMatch(/GRANT EXECUTE ON FUNCTION public\.search_patients_for_clinic/);
  });
});
