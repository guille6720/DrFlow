import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import { mergeTreatmentsForPersist } from "@/features/historias/utils/clinical-structured-entries";

describe("113_clinical_treatments_catalog migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/113_clinical_treatments_catalog.sql"),
    "utf8"
  );

  it("creates independent treatment catalog with kinds and search RPC", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS clinical_treatments/);
    expect(sql).toMatch(/pharmacologic/);
    expect(sql).toMatch(/non_pharmacologic/);
    expect(sql).toMatch(/conduct/);
    expect(sql).toMatch(/search_clinical_treatments/);
    expect(sql).toMatch(/Analgésico/);
    expect(sql).toMatch(/Dieta hiposódica/);
    expect(sql).toMatch(/Solicitar MAPA/);
  });

  it("does not auto-link treatments to diagnoses", () => {
    expect(sql).not.toMatch(/REFERENCES clinical_diagnoses/);
    expect(sql).not.toMatch(/ADD COLUMN IF NOT EXISTS diagnosis_id/);
    expect(sql).toMatch(/NOT linked to diagnoses/i);
  });
});

describe("mergeTreatmentsForPersist", () => {
  it("keeps catalog treatments and medications as separate kinds", () => {
    const merged = mergeTreatmentsForPersist(
      [
        {
          product: "Antihipertensivo",
          kind: "pharmacologic",
          clinical_treatment_id: "11111111-1111-1111-1111-111111111111",
        },
      ],
      [
        {
          generic_name: "Enalapril",
          brand_name: "GLIOTEN",
          presentation: "10 MG",
          quantity: 1,
          posology: "1-0-0",
        },
      ]
    );
    expect(merged[0]?.kind).toBe("pharmacologic");
    expect(merged[1]?.kind).toBe("medication");
  });
});
