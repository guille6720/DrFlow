import { describe, expect, it } from "vitest";
import {
  CLINICAL_AI_AGENT_LABELS,
  listClinicalAiAgents,
  resolveAgentForCopilotIntent,
  resolveAgentForTask,
  runClinicalAiOrchestrator,
} from "@/lib/utils/clinical-ai-orchestrator";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

function chartStub(overrides: Partial<PatientChartPayload> = {}): PatientChartPayload {
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
    medications: [],
    vitals: [],
    latestVitals: {},
    labPanel: [{ name: "HbA1c", value: "8.4", unit: "%", status: "high" }],
    profileCompleteness: { score: 80, missing: [] },
    consultations: [],
    labs: [],
    vaccines: [],
    habits: { smoker: "—", alcohol: "—", activity: "—", diet: "—", occupation: "—", packYears: "—" },
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

describe("clinical-ai-orchestrator", () => {
  it("listClinicalAiAgents returns all agent labels", () => {
    const agents = listClinicalAiAgents();
    expect(agents.length).toBe(7);
    expect(CLINICAL_AI_AGENT_LABELS.pre_visit_agent).toContain("pre-consulta");
  });

  it("resolveAgentForTask maps tasks to agents", () => {
    expect(resolveAgentForTask("pre_visit_brief")).toBe("pre_visit_agent");
    expect(resolveAgentForTask("copilot_query")).toBe("copilot_agent");
    expect(resolveAgentForCopilotIntent("patient_summary")).toBe("pre_visit_agent");
  });

  it("runClinicalAiOrchestrator pre_visit_brief", () => {
    const result = runClinicalAiOrchestrator({
      task: "pre_visit_brief",
      patientName: "Pérez, Juan",
      chart: chartStub(),
    });
    expect(result.agentId).toBe("pre_visit_agent");
    expect(result.body).toContain("Pérez, Juan");
    expect(result.engine).toBe("rule_based");
  });

  it("runClinicalAiOrchestrator copilot routes to medication agent for rx intent", () => {
    const result = runClinicalAiOrchestrator({
      task: "copilot_query",
      message: "Generá una receta igual a la anterior",
      copilotContext: {
        patientId: "p1",
        patientName: "Juan",
        lastPrescriptionLines: ["Metformina 850"],
      },
    });
    expect(result.agentId).toBe("medication_order_agent");
    expect(result.body.toLowerCase()).toContain("metformina");
  });

  it("runClinicalAiOrchestrator lab_interpretation parses text", () => {
    const result = runClinicalAiOrchestrator({
      task: "lab_interpretation",
      labSourceText: "HbA1c 7.2 %",
    });
    expect(result.agentId).toBe("lab_interpretation_agent");
    expect(result.body).toContain("HbA1c");
  });

  it("runClinicalAiOrchestrator close_encounter bundles steps", () => {
    const result = runClinicalAiOrchestrator({
      task: "close_encounter",
      assistContext: {
        lastEvolution: "Control estable.",
        lastDiagnosis: "HTA",
      },
    });
    expect(result.agentId).toBe("close_encounter_agent");
    expect(result.body.length).toBeGreaterThan(10);
  });

  it("runClinicalAiOrchestrator documentation returns items for evolution context", () => {
    const result = runClinicalAiOrchestrator({
      task: "consultation_documentation",
      assistContext: {
        evolutionText: "Dolor lumbar hace tres semanas",
        chiefComplaint: "lumbalgia",
      },
    });
    expect(result.agentId).toBe("documentation_agent");
    expect(result.items.length).toBeGreaterThan(0);
  });
});
