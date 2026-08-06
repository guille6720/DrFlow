import {
  isFromClinicalHistory,
  patientClinicalHistoryPath,
} from "@/shared/utils/clinical-navigation";

import {
  DEFAULT_HC_WORKSPACE_TAB,
  isHcWorkspaceTab,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";

/** Destino del enlace «Volver» en la ficha del paciente según tab activo. */
export function patientWorkspaceBackHref(
  patientId: string,
  tab: PatientWorkspaceTabId,
  from?: string | null,
  returnPatientId?: string
): string {
  const resolvedPatientId = returnPatientId ?? patientId;

  if (isFromClinicalHistory(from)) {
    return patientClinicalHistoryPath(resolvedPatientId);
  }

  if (isHcWorkspaceTab(tab) && tab !== DEFAULT_HC_WORKSPACE_TAB) {
    return patientClinicalHistoryPath(patientId);
  }

  return "/pacientes";
}
