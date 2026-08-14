import { readFileSync } from "fs";
import { resolve } from "path";
import { describe, expect, it } from "vitest";

import {
  diagnosisFavoriteFingerprint,
  medicationFavoriteFingerprint,
  treatmentFavoriteFingerprint,
} from "@/features/historias/types/clinical-favorites";

describe("114_clinical_favorites migration", () => {
  const sql = readFileSync(
    resolve(process.cwd(), "supabase/migrations/114_clinical_favorites.sql"),
    "utf8"
  );

  it("creates per-user favorites table with RLS on user_id", () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.clinical_favorites/);
    expect(sql).toMatch(/kind TEXT NOT NULL CHECK \(kind IN \('diagnosis', 'treatment', 'medication'\)\)/);
    expect(sql).toMatch(/user_id = auth\.uid\(\)/);
    expect(sql).toMatch(/UNIQUE \(user_id, kind, fingerprint\)/);
    expect(sql).toMatch(/ENABLE ROW LEVEL SECURITY/);
  });
});

describe("clinical favorite fingerprints", () => {
  it("prefers catalog ids when available", () => {
    expect(
      diagnosisFavoriteFingerprint({
        name: "Hipertensión arterial",
        clinical_diagnosis_id: "11111111-1111-1111-1111-111111111111",
      })
    ).toBe("id:11111111-1111-1111-1111-111111111111");

    expect(
      treatmentFavoriteFingerprint({
        product: "Control de PA",
        clinical_treatment_id: "22222222-2222-2222-2222-222222222222",
      })
    ).toBe("id:22222222-2222-2222-2222-222222222222");

    expect(
      medicationFavoriteFingerprint({
        generic_name: "Amoxicilina",
        vademecum_code: "42415",
      })
    ).toBe("code:42415");
  });

  it("normalizes free-text fingerprints without accents", () => {
    expect(
      diagnosisFavoriteFingerprint({
        name: "Hipertensión arterial",
        cie10_code: "I10",
      })
    ).toBe("name:hipertension arterial|cie:i10");
  });
});
