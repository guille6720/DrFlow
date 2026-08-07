import {
  isFromClinicalHistory,
  patientClinicalHistoryPath,
} from "@/shared/utils/clinical-navigation";

import {
  DEFAULT_HC_WORKSPACE_TAB,
  DEFAULT_PATIENT_WORKSPACE_TAB,
  isHcWorkspaceTab,
  type PatientWorkspaceTabId,
} from "@/features/pacientes/constants/patient-workspace-tabs";

export type PatientWorkspaceBackContext = {
  from?: string | null;
  returnPatientId?: string;
  record?: string | null;
  action?: string | null;
  sheet?: string | null;
  mode?: string | null;
  focus?: string | null;
};

function hasHcDeepLinkState(ctx: PatientWorkspaceBackContext): boolean {
  return Boolean(ctx.record || ctx.action || ctx.sheet || ctx.mode || ctx.focus);
}

/** Destino del enlace «Volver» en la ficha del paciente según tab y estado de la URL. */
export function patientWorkspaceBackHref(
  patientId: string,
  tab: PatientWorkspaceTabId,
  ctx: PatientWorkspaceBackContext = {}
): string {
  const resolvedPatientId = ctx.returnPatientId ?? patientId;

  if (isFromClinicalHistory(ctx.from)) {
    return patientClinicalHistoryPath(resolvedPatientId);
  }

  if (isHcWorkspaceTab(tab)) {
    if (hasHcDeepLinkState(ctx) || tab !== DEFAULT_HC_WORKSPACE_TAB) {
      return patientClinicalHistoryPath(patientId);
    }
    return `/pacientes/${patientId}`;
  }

  if (tab === DEFAULT_PATIENT_WORKSPACE_TAB) {
    return "/pacientes";
  }

  // Archivos, estudios, timeline, etc.: volver al resumen del mismo paciente.
  return `/pacientes/${patientId}`;
}
