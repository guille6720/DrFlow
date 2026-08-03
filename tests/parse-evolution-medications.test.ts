import { describe, expect, it } from "vitest";
import {
  extractEvolutionDiagnosis,
  parseEvolutionMedications,
} from "@/lib/utils/parse-evolution-medications";

describe("parseEvolutionMedications", () => {
  it("parses guide drug lines with brand and dosage", () => {
    const meds = parseEvolutionMedications(
      "Paciente con cefalea.\n• paracetamol (Tafirol) — comp x 20 — Dosis ref.: 500 mg c/8h"
    );
    expect(meds).toHaveLength(1);
    expect(meds[0]).toMatchObject({
      generic_name: "paracetamol",
      brand_name: "Tafirol",
      presentation: "comp x 20",
      posology: "500 mg c/8h",
    });
  });

  it("parses vademecum-style lines", () => {
    const meds = parseEvolutionMedications("• losartán — LOSARTAN DK — comp x 30");
    expect(meds).toHaveLength(1);
    expect(meds[0]).toMatchObject({
      generic_name: "losartán",
      brand_name: "LOSARTAN DK",
      presentation: "comp x 30",
    });
  });

  it("extracts diagnosis without medication bullets", () => {
    const text =
      "Control de HTA.\n\n• enalapril — comp x 30 — Dosis ref.: 1 comp/día\n\nContinuar dieta.";
    expect(extractEvolutionDiagnosis(text)).toBe("Control de HTA.\n\nContinuar dieta.");
    expect(parseEvolutionMedications(text)).toHaveLength(1);
  });
});
