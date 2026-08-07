import type { ClinicalAiRequest } from "@/core/validations/clinical-ai-api";

import type { PhysicianAssistContext } from "@/features/ia/types/physician-assist-types";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";

import type { ClinicalAiOrchestratorInput } from "@/lib/utils/clinical-ai-orchestrator";
import type { ClinicalCopilotContext } from "@/lib/utils/clinical-copilot";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Maps validated API payload (loose JSON records) to orchestrator input. */
export function buildClinicalAiOrchestratorInput(
  payload: ClinicalAiRequest
): ClinicalAiOrchestratorInput {
  return {
    task: payload.task,
    message: payload.message,
    patientId: payload.patientId,
    patientName: payload.patientName,
    labSourceText: payload.labSourceText,
    lastConsultAt: payload.lastConsultAt ?? undefined,
    assistContext: isRecord(payload.assistContext)
      ? (payload.assistContext as PhysicianAssistContext)
      : undefined,
    copilotContext: isRecord(payload.copilotContext)
      ? (payload.copilotContext as ClinicalCopilotContext)
      : undefined,
    chart: isRecord(payload.chart) ? (payload.chart as PatientChartPayload) : undefined,
  };
}
