import { describe, expect, it } from "vitest";
import {
  buildClinicalWorkspaceAlerts,
  buildLastConsultSummary,
  detectMedicationFlags,
} from "@/features/pacientes/utils/clinical-workspace-alerts";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

function minimalChart(overrides: Partial<PatientChartPayload> = {}): PatientChartPayload {
  return {
    ageLabel: "45 años",
    ageYears: 45,
    sex: "Femenino",
    insurance: "OSDE",
    bloodGroup: "O+",
    activeProblemsText: [],
    chronicConditions: [],
    allergies: [],
    criticalMeds: [],
    anticoagulated: false,
    cvRisk: "Moderado",
    smokingLabel: "No fumador",
    alerts: [],
    problems: [],
    medications: [],
    vitals: [],
    latestVitals: {},
    labPanel: [],
    profileCompleteness: { score: 80, missing: [] },
    consultations: [],
    labs: [],
    vaccines: [],
    habits: { smoker: "", alcohol: "", activity: "", diet: "", occupation: "", packYears: "" },
    family: [],
    studies: [],
    documents: [],
    reminders: [],
    safetyWarnings: [],
    indicators: { bmi: null, tfg: null, cvScore: null, packYears: null, creatinine: null },
    extras: {},
    ...overrides,
  };
}

describe("clinical-workspace-alerts", () => {
  it("builds critical allergy alerts", () => {
    const alerts = buildClinicalWorkspaceAlerts(
      minimalChart({ allergies: ["Penicilina", "Maní"] })
    );
    expect(alerts.some((a) => a.kind === "drug_allergy")).toBe(true);
    expect(alerts.some((a) => a.kind === "food_allergy")).toBe(true);
    expect(alerts.every((a) => a.severity === "critical" || a.severity === "high")).toBe(true);
  });

  it("flags anticoagulation", () => {
    const alerts = buildClinicalWorkspaceAlerts(minimalChart({ anticoagulated: true }));
    expect(alerts.some((a) => a.kind === "anticoagulant")).toBe(true);
  });

  it("summarizes last consultation", () => {
    const summary = buildLastConsultSummary(
      {
        id: "c1",
        created_at: "2026-07-30T12:00:00.000Z",
        professional_name: "Dr. López",
        chief_complaint: "Cefalea",
        diagnosis: "Migraña",
        evolution: "Mejoría parcial",
        indications: "Control en 15 días",
        category: "consultation",
      },
      ["Ibuprofeno"],
      ["Hemograma"]
    );
    expect(summary?.chiefComplaint).toBe("Cefalea");
    expect(summary?.prescriptions).toContain("Ibuprofeno");
    expect(summary?.orders).toContain("Hemograma");
  });

  it("detects duplicate medications", () => {
    const flags = detectMedicationFlags([
      {
        id: "1",
        name: "Losartán",
        dose: "50mg",
        frequency: "1/d",
        sinceLabel: "2024",
        lastRenewalLabel: "2026",
        raw: { name: "Losartán" } as never,
      },
      {
        id: "2",
        name: "Losartán",
        dose: "50mg",
        frequency: "1/d",
        sinceLabel: "2025",
        lastRenewalLabel: "2026",
        raw: { name: "Losartán" } as never,
      },
    ]);
    expect(flags.some((f) => f.includes("duplicación"))).toBe(true);
  });
});
