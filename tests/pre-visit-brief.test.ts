import { describe, expect, it } from "vitest";

import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

import { buildPreVisitBrief, formatMonthsSince } from "@/lib/utils/pre-visit-brief";

function minimalChart(overrides: Partial<PatientChartPayload> = {}): PatientChartPayload {
  return {
    ageLabel: "62 años",
    ageYears: 62,
    sex: "Masculino",
    insurance: "OSDE",
    bloodGroup: "O+",
    activeProblemsText: ["Diabetes tipo 2", "Hipertensión arterial"],
    chronicConditions: ["Diabetes tipo 2"],
    allergies: ["Penicilina"],
    criticalMeds: ["Metformina"],
    anticoagulated: false,
    cvRisk: "Moderado",
    smokingLabel: "Sin registrar",
    alerts: [{ level: "red", label: "Alergia: Penicilina" }],
    problems: [],
    medications: [
      {
        id: "1",
        name: "Metformina",
        dose: "850 mg",
        frequency: "c/12h",
        sinceLabel: "—",
        lastRenewalLabel: "—",
        raw: {} as never,
      },
      {
        id: "2",
        name: "Losartán",
        dose: "50 mg",
        frequency: "c/24h",
        sinceLabel: "—",
        lastRenewalLabel: "—",
        raw: {} as never,
      },
    ],
    vitals: [],
    latestVitals: {},
    labPanel: [
      { name: "HbA1c", value: "7.2", unit: "%", status: "high" },
      { name: "Colesterol", value: "—", status: "empty" },
    ],
    profileCompleteness: { score: 80, missing: [] },
    consultations: [{ id: "c1", dateLabel: "01/05/2026", title: "Control", professional: "Dr. Test" }],
    labs: [],
    vaccines: [],
    habits: {
      smoker: "Sin registrar",
      alcohol: "Sin registrar",
      activity: "Sin registrar",
      diet: "Sin registrar",
      occupation: "Sin registrar",
      packYears: "—",
    },
    family: [],
    studies: [],
    documents: [],
    reminders: ["Diabético: sin HbA1c reciente registrada"],
    safetyWarnings: [],
    indicators: { bmi: null, tfg: null, cvScore: null, packYears: null, creatinine: null },
    extras: {},
    ...overrides,
  };
}

describe("pre-visit-brief", () => {
  it("formatMonthsSince returns Spanish relative labels", () => {
    const now = new Date("2026-08-01T12:00:00Z").getTime();
    expect(formatMonthsSince("2026-05-01T12:00:00Z", now)).toBe("hace 3 meses");
    expect(formatMonthsSince("2026-07-01T12:00:00Z", now)).toBe("hace 1 mes");
    expect(formatMonthsSince("2026-07-28T12:00:00Z", now)).toBe("hace menos de 1 mes");
  });

  it("buildPreVisitBrief structures headline, sections, and alerts", () => {
    const now = new Date("2026-08-01T12:00:00Z").getTime();
    const brief = buildPreVisitBrief({
      patientName: "Juan Pérez",
      chart: minimalChart(),
      lastConsultAt: "2026-05-01T12:00:00Z",
      nowMs: now,
    });

    expect(brief.headline).toBe("Juan Pérez · 62 años");
    expect(brief.sections.find((s) => s.label === "Condiciones")?.value).toContain("Diabetes");
    expect(brief.sections.find((s) => s.label === "Alergias")?.value).toBe("Penicilina");
    expect(brief.sections.find((s) => s.label === "Última consulta")?.value).toBe("hace 3 meses");
    expect(brief.sections.find((s) => s.label === "Labs destacados")?.value).toContain("HbA1c 7.2 %");
    expect(brief.sections.find((s) => s.label === "Medicación")?.value).toContain("Metformina");
    expect(brief.alertLines.some((l) => l.includes("Penicilina"))).toBe(true);
    expect(brief.plainText).toContain("Juan Pérez");
  });

  it("falls back to consultation dateLabel when lastConsultAt is missing", () => {
    const brief = buildPreVisitBrief({
      patientName: "Ana López",
      chart: minimalChart({ consultations: [] }),
      nowMs: new Date("2026-08-01T12:00:00Z").getTime(),
    });
    expect(brief.sections.find((s) => s.label === "Última consulta")?.value).toBe("Sin consultas registradas");
  });
});
