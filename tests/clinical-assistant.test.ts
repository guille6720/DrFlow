import { describe, expect, it } from "vitest";
import {
  buildClinicalSummary,
  buildLightweightPatientWarnings,
  buildMedicationSafetyWarnings,
  extractPathologySearchQuery,
} from "@/lib/utils/clinical-assistant";

describe("clinical-assistant", () => {
  it("extractPathologySearchQuery strips CIE-10 codes", () => {
    expect(
      extractPathologySearchQuery({
        lastDiagnosis: "Hipertensión arterial CIE-10: I10",
      })
    ).toBe("Hipertensión arterial");
  });

  it("buildClinicalSummary includes demographics and alerts", () => {
    const lines = buildClinicalSummary({
      ageLabel: "45 años",
      sex: "Masculino",
      insurance: "OSDE",
      activeProblems: ["HTA"],
      allergies: ["Penicilina"],
      medicationCount: 2,
      lastConsultLabel: "01/08/2026",
      alerts: [{ level: "red", label: "Alergia: Penicilina" }],
    });
    expect(lines[0]).toContain("45 años");
    expect(lines.some((l) => l.includes("Alergias"))).toBe(true);
    expect(lines.some((l) => l.includes("Alertas críticas"))).toBe(true);
  });

  it("buildMedicationSafetyWarnings detects penicillin allergy conflict", () => {
    const warnings = buildMedicationSafetyWarnings({
      allergies: ["Penicilina"],
      medications: [
        {
          id: "1",
          name: "Amoxicilina",
          dose: "—",
          frequency: "—",
          sinceLabel: "—",
          lastRenewalLabel: "—",
          raw: {} as never,
        },
      ],
    });
    expect(warnings.some((w) => w.includes("penicilina"))).toBe(true);
  });

  it("buildMedicationSafetyWarnings detects NSAID + anticoagulant", () => {
    const warnings = buildMedicationSafetyWarnings({
      allergies: [],
      medications: [
        {
          id: "1",
          name: "Warfarina",
          dose: "—",
          frequency: "—",
          sinceLabel: "—",
          lastRenewalLabel: "—",
          raw: {} as never,
        },
        {
          id: "2",
          name: "Ibuprofeno",
          dose: "—",
          frequency: "—",
          sinceLabel: "—",
          lastRenewalLabel: "—",
          raw: {} as never,
        },
      ],
    });
    expect(warnings.some((w) => w.includes("AINE"))).toBe(true);
  });

  it("buildLightweightPatientWarnings includes evolution medication lines", () => {
    const warnings = buildLightweightPatientWarnings({
      allergies: null,
      regularMedication: "Losartan",
      evolutionText: "Control HTA\n• Enalapril 10 mg",
    });
    expect(warnings.some((w) => w.includes("IECA"))).toBe(true);
  });
});
