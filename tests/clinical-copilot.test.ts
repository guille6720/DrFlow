import { describe, expect, it } from "vitest";
import {
  buildCopilotResponse,
  buildCopilotSuggestedPrompts,
  matchCopilotIntent,
  runClinicalCopilotQuery,
} from "@/lib/utils/clinical-copilot";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";

const chartStub = {
  chronicConditions: ["DM2"],
  activeProblemsText: ["Diabetes"],
  labPanel: [],
  profileCompleteness: { score: 90, missing: [] },
  reminders: [],
  alerts: [],
  safetyWarnings: [],
  medications: [],
} as PatientChartPayload;

describe("clinical-copilot", () => {
  it("matchCopilotIntent detects recent consultations query", () => {
    expect(matchCopilotIntent("Mostrame las últimas tres consultas")).toBe("recent_consultations");
  });

  it("matchCopilotIntent detects repeat prescription", () => {
    expect(matchCopilotIntent("Generá una receta igual a la anterior")).toBe("repeat_prescription");
  });

  it("buildCopilotResponse lists recent consultations", () => {
    const res = buildCopilotResponse("recent_consultations", {
      patientId: "p1",
      patientName: "Pérez, Juan",
      recentConsultations: [
        { dateLabel: "01/01/2026", motive: "Control", diagnosis: "DM2" },
      ],
    });
    expect(res.body).toContain("Control");
    expect(res.actions.some((a) => a.href?.includes("/pacientes/p1"))).toBe(true);
  });

  it("runClinicalCopilotQuery returns help without patient context", () => {
    const res = runClinicalCopilotQuery("resumen", {});
    expect(res.intent).toBe("help");
  });

  it("buildCopilotSuggestedPrompts includes patient prompts when in context", () => {
    const prompts = buildCopilotSuggestedPrompts({ patientId: "p1" });
    expect(prompts.some((p) => p.toLowerCase().includes("consultas"))).toBe(true);
  });

  it("buildCopilotResponse handles missing studies for diabetic patient", () => {
    const res = buildCopilotResponse("missing_studies", {
      patientId: "p1",
      patientName: "Pérez, Juan",
      chart: chartStub,
      assistContext: { orderIntentText: "control diabetes", lastDiagnosis: "DM2" },
    });
    expect(res.body).toContain("HbA1c");
  });

  it("buildCopilotResponse returns proactive alerts from chart", () => {
    const res = buildCopilotResponse("proactive_alerts", {
      patientId: "p1",
      patientName: "Pérez, Juan",
      chart: {
        ...chartStub,
        chronicConditions: ["Diabetes mellitus tipo 2"],
        activeProblemsText: ["DM2"],
        labPanel: [{ name: "HbA1c", value: "—", status: "empty" }],
        profileCompleteness: { score: 70, missing: ["Laboratorio reciente"] },
        reminders: [],
        extras: { vaccines: [{ name: "Antigripal", status: "missing" }] },
      },
      lastConsultAt: new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString(),
    });
    expect(res.body.length).toBeGreaterThan(10);
  });

  it("buildCopilotResponse navigates to soap and close wizard", () => {
    const soap = buildCopilotResponse("open_soap", { patientId: "p1", patientName: "Juan" });
    expect(soap.actions[0]?.href).toContain("action=nueva");
    const close = buildCopilotResponse("open_close_wizard", { patientId: "p1", patientName: "Juan" });
    expect(close.actions[0]?.href).toContain("action=cerrar");
    const labs = buildCopilotResponse("open_labs", { patientId: "p1", patientName: "Juan" });
    expect(labs.actions[0]?.href).toContain("action=estudio");
  });

  it("buildCopilotResponse summarizes patient with chart", () => {
    const res = buildCopilotResponse("patient_summary", {
      patientId: "p1",
      patientName: "Pérez, Juan",
      chart: {
        ...chartStub,
        ageLabel: "50 años",
        allergies: [],
        medications: [],
        consultations: [],
        labPanel: [],
      },
    });
    expect(res.body).toContain("Pérez, Juan");
  });

  it("buildCopilotResponse repeat prescription uses last lines", () => {
    const res = buildCopilotResponse("repeat_prescription", {
      patientId: "p1",
      patientName: "Juan",
      lastPrescriptionLines: ["Metformina 850 mg", "Losartán 50 mg"],
    });
    expect(res.body).toContain("Metformina");
    expect(res.actions.some((a) => a.copyText)).toBe(true);
  });

  it("matchCopilotIntent covers additional intents", () => {
    expect(matchCopilotIntent("alertas de seguimiento")).toBe("proactive_alerts");
    expect(matchCopilotIntent("abrir soap")).toBe("open_soap");
    expect(matchCopilotIntent("generar cierre")).toBe("open_close_wizard");
    expect(matchCopilotIntent("interpretar laboratorio")).toBe("open_labs");
    expect(matchCopilotIntent("labs pendientes")).toBe("pending_labs");
  });
});
