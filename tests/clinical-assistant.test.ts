import { describe, expect, it } from "vitest";
import {
  buildClinicalSummary,
  buildDifferentialDiagnosisSuggestions,
  buildLightweightPatientWarnings,
  buildMedicationSafetyWarnings,
  buildPhysicianAssistItems,
  buildSoapDraftSuggestion,
  buildPrescriptionDraftSuggestion,
  buildOrderDraftSuggestion,
  buildDischargeSummarySuggestion,
  buildMedicalCertificateDraft,
  buildInteractionAlertItems,
  buildClinicalSummaryAssistItem,
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

  it("buildSoapDraftSuggestion returns structured SOAP", () => {
    const item = buildSoapDraftSuggestion({
      evolutionText: "Paciente con cefalea",
      diagnosis: "Cefalea tensional",
    });
    expect(item?.body).toContain("S (Subjetivo)");
    expect(item?.body).toContain("A (Análisis)");
  });

  it("buildDifferentialDiagnosisSuggestions matches symptom keywords", () => {
    const items = buildDifferentialDiagnosisSuggestions({
      evolutionText: "fiebre tos disnea",
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].body).toContain("Neumonía");
  });

  it("buildDifferentialDiagnosisSuggestions matches lumbar pain", () => {
    const items = buildDifferentialDiagnosisSuggestions({
      evolutionText: "dolor lumbar hace tres semanas sin irradiación",
    });
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].body).toContain("Lumbalgia");
  });

  it("buildPhysicianAssistItems includes documentation kinds", () => {
    const items = buildPhysicianAssistItems(
      { evolutionText: "dolor lumbar hace tres semanas, sin irradiación, no fiebre" },
      ["evolution_draft", "physical_exam", "therapeutic_plan", "soap", "differential"]
    );
    expect(items.some((i) => i.kind === "evolution_draft")).toBe(true);
    expect(items.some((i) => i.kind === "physical_exam")).toBe(true);
    expect(items.some((i) => i.kind === "therapeutic_plan")).toBe(true);
  });

  it("buildPhysicianAssistItems filters by kind", () => {
    const items = buildPhysicianAssistItems(
      { evolutionText: "dolor torácico opresivo", allergies: "Penicilina" },
      ["interaction_alert", "differential"]
    );
    expect(items.every((i) => i.kind === "interaction_alert" || i.kind === "differential")).toBe(
      true
    );
  });

  it("buildPrescriptionDraftSuggestion returns Rx draft", () => {
    const item = buildPrescriptionDraftSuggestion({
      evolutionText: "HTA controlada",
      diagnosis: "Hipertensión arterial",
      regularMedication: "Losartan 50 mg",
    });
    expect(item?.kind).toBe("prescription_draft");
    expect(item?.body).toContain("Losartan");
  });

  it("buildOrderDraftSuggestion returns order draft", () => {
    const item = buildOrderDraftSuggestion({
      evolutionText: "Control de diabetes",
      diagnosis: "Diabetes mellitus tipo 2",
    });
    expect(item?.kind).toBe("order_draft");
    expect(item?.body).toContain("HbA1c");
  });

  it("buildDischargeSummarySuggestion returns discharge draft", () => {
    const item = buildDischargeSummarySuggestion({
      evolutionText: "Evolución favorable",
      diagnosis: "Neumonía resuelta",
    });
    expect(item?.kind).toBe("discharge_summary");
  });

  it("buildMedicalCertificateDraft returns certificate draft", () => {
    const item = buildMedicalCertificateDraft({
      evolutionText: "Reposo indicado",
      diagnosis: "Lumbalgia",
    });
    expect(item?.kind).toBe("medical_certificate");
  });

  it("buildInteractionAlertItems flags allergy conflicts", () => {
    const items = buildInteractionAlertItems({
      allergies: "Penicilina",
      proposedMedications: ["Amoxicilina"],
    });
    expect(items.some((i) => i.kind === "interaction_alert")).toBe(true);
  });

  it("buildPhysicianAssistItems can include all assist kinds", () => {
    const items = buildPhysicianAssistItems(
      {
        evolutionText: "fiebre disnea tos",
        diagnosis: "Neumonía",
        allergies: "Penicilina",
        regularMedication: "Warfarina",
        proposedMedications: ["Ibuprofeno"],
      },
      [
        "soap_draft",
        "differential",
        "prescription_draft",
        "order_draft",
        "discharge_summary",
        "medical_certificate",
        "interaction_alert",
        "clinical_summary",
      ]
    );
    expect(items.length).toBeGreaterThan(3);
  });
});
