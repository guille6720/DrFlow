import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  primaryDiagnosisCie10,
  resolveDiagnosesForRecord,
  resolveTreatmentsForRecord,
} from "@/features/historias/utils/clinical-structured-entries";

describe("111_clinical_record_dx_tx_normalization migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/111_clinical_record_dx_tx_normalization.sql"),
    "utf8"
  );

  it("creates normalized child tables and problem list", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinical_record_diagnoses/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinical_record_treatments/);
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS patient_problem_list/);
  });

  it("syncs children from JSON inside create/update RPCs", () => {
    expect(sql).toMatch(/sync_clinical_record_children/);
    expect(sql).toMatch(/create_clinical_record_atomic/);
    expect(sql).toMatch(/update_clinical_record_atomic/);
    expect(sql.indexOf("PERFORM public.sync_clinical_record_children")).toBeGreaterThan(
      sql.indexOf("CREATE OR REPLACE FUNCTION public.create_clinical_record_atomic")
    );
  });

  it("exposes CIE-10 and treatment occurrence stats", () => {
    expect(sql).toMatch(/clinic_cie10_occurrence_stats/);
    expect(sql).toMatch(/clinic_treatment_occurrence_stats/);
  });
});

describe("clinical structured resolve helpers", () => {
  it("prefers child rows over JSON", () => {
    const diagnoses = resolveDiagnosesForRecord({
      diagnoses_rows: [{ name: "HTA", cie10_code: "I10" }],
      diagnoses_json: [{ name: "From JSON", cie10_code: "Z00" }],
    });
    expect(diagnoses[0]?.cie10_code).toBe("I10");

    const treatments = resolveTreatmentsForRecord({
      treatments_rows: [{ product: "Enalapril 10mg" }],
      treatments_json: [{ product: "From JSON" }],
    });
    expect(treatments[0]?.product).toBe("Enalapril 10mg");
  });

  it("falls back to JSON when child rows empty", () => {
    const diagnoses = resolveDiagnosesForRecord({
      diagnoses_rows: [],
      diagnoses_json: [{ name: "From JSON", cie10_code: "J06.9" }],
    });
    expect(primaryDiagnosisCie10(diagnoses)).toBe("J06.9");
  });
});
