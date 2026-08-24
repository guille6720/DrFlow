import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { parseDiagnosesJson } from "@/features/historias/utils/clinical-structured-entries";

describe("112_clinical_diagnoses_catalog migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/112_clinical_diagnoses_catalog.sql"),
    "utf8"
  );

  it("creates clinical_diagnoses catalog with search indexes and RPC", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinical_diagnoses/);
    expect(sql).toMatch(/synonyms TEXT\[\]/);
    expect(sql).toMatch(/search_clinical_diagnoses/);
    expect(sql).toMatch(/immutable_unaccent/);
    expect(sql).toMatch(/Hipertensión arterial/);
    expect(sql).toMatch(/Hipertensión pulmonar/);
  });

  it("links catalog selection onto clinical_record_diagnoses without rewriting TEXT", () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS clinical_diagnosis_id/);
    expect(sql).toMatch(/snomed_code/);
    expect(sql).not.toMatch(/UPDATE clinical_records\s+SET\s+diagnosis/i);
  });
});

describe("parseDiagnosesJson catalog fields", () => {
  it("keeps clinical_diagnosis_id and snomed for dual-write", () => {
    const parsed = parseDiagnosesJson([
      {
        name: "Hipertensión arterial",
        cie10_code: "I10",
        snomed_code: "38341003",
        clinical_diagnosis_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      },
    ]);
    expect(parsed[0]).toMatchObject({
      name: "Hipertensión arterial",
      cie10_code: "I10",
      snomed_code: "38341003",
      clinical_diagnosis_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
    });
  });
});
