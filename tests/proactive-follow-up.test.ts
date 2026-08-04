import { describe, expect, it } from "vitest";
import {
  buildProactiveCareItems,
  buildProactiveCareSummaryText,
  countProactiveCareBySeverity,
  sortProactiveCareItems,
} from "@/lib/utils/proactive-follow-up";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

function baseChart(overrides: Partial<PatientChartPayload> = {}): PatientChartPayload {
  return {
    ageLabel: "64 años",
    ageYears: 64,
    sex: "Masculino",
    insurance: "PAMI",
    bloodGroup: "O+",
    activeProblemsText: ["Diabetes tipo 2"],
    chronicConditions: ["Diabetes mellitus tipo 2"],
    allergies: ["Penicilina"],
    criticalMeds: [],
    anticoagulated: false,
    cvRisk: "Moderado",
    smokingLabel: "Sin registrar",
    alerts: [],
    problems: [],
    medications: [{ id: "1", name: "Metformina", dose: "850", frequency: "c/12h", sinceLabel: "—", lastRenewalLabel: "—", raw: {} as never }],
    vitals: [],
    latestVitals: {},
    labPanel: [
      { name: "HbA1c", value: "8.4", unit: "%", status: "high" },
      { name: "Creatinina", value: "—", status: "empty" },
    ],
    profileCompleteness: { score: 80, missing: ["Laboratorio reciente"] },
    consultations: [],
    labs: [],
    vaccines: [],
    habits: { smoker: "—", alcohol: "—", activity: "—", diet: "—", occupation: "—", packYears: "—" },
    family: [],
    studies: [],
    documents: [],
    reminders: ["Diabético: sin HbA1c reciente registrada"],
    safetyWarnings: [],
    indicators: { bmi: null, tfg: null, cvScore: null, packYears: null, creatinine: null },
    extras: { vaccines: [{ name: "Antigripal", status: "missing" }] },
    ...overrides,
  };
}

describe("proactive-follow-up", () => {
  it("buildProactiveCareItems flags diabetic with high hba1c", () => {
    const items = buildProactiveCareItems({
      patientId: "p1",
      chart: baseChart(),
      lastConsultAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(items.some((i) => i.category === "glycemic_target")).toBe(true);
    expect(items.some((i) => i.category === "vaccination")).toBe(true);
  });

  it("sortProactiveCareItems orders by severity", () => {
    const items = sortProactiveCareItems([
      { id: "a", category: "vaccination", severity: "low", title: "A", detail: "a" },
      { id: "b", category: "overdue_visit", severity: "high", title: "B", detail: "b" },
    ]);
    expect(items[0]?.severity).toBe("high");
  });

  it("countProactiveCareBySeverity aggregates counts", () => {
    const counts = countProactiveCareBySeverity(
      buildProactiveCareItems({
        patientId: "p1",
        chart: baseChart(),
        lastConsultAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
      })
    );
    expect(counts.high + counts.medium + counts.low).toBeGreaterThan(0);
  });

  it("buildProactiveCareSummaryText formats list", () => {
    const text = buildProactiveCareSummaryText([
      { id: "1", category: "pending_labs", severity: "high", title: "Lab", detail: "Pendiente" },
    ]);
    expect(text).toContain("Lab");
  });

  it("buildProactiveCareItems flags hypertensive follow-up", () => {
    const items = buildProactiveCareItems({
      patientId: "p1",
      chart: baseChart({
        chronicConditions: ["Hipertensión arterial"],
        activeProblemsText: ["HTA"],
        labPanel: [],
      }),
      lastConsultAt: new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(items.some((i) => i.category === "hypertension_followup")).toBe(true);
  });

  it("buildProactiveCareItems returns empty summary when no alerts", () => {
    expect(buildProactiveCareSummaryText([])).toContain("Sin alertas");
  });
});
