import { PATIENT_EHR_RECORD_PAGE_SIZE } from "@/core/supabase/pagination";

import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { PATIENT_EHR_RECORD_LIMIT } from "@/features/pacientes/server/load-patient-ehr-data";

export type WorkspaceFetchPlan = {
  clinicalRecords: boolean;
  attachments: boolean;
  prescriptions: boolean;
  orders: boolean;
  appointments: boolean;
  hceSummary: boolean;
  templates: boolean;
  /** Lighter record limit for chart-focused tabs. */
  recordLimit?: number;
};

const TIMELINE: WorkspaceFetchPlan = {
  clinicalRecords: true,
  attachments: true,
  prescriptions: true,
  orders: true,
  appointments: true,
  hceSummary: true,
  templates: false,
  recordLimit: PATIENT_EHR_RECORD_PAGE_SIZE,
};

const LIGHT_SHELL: WorkspaceFetchPlan = {
  clinicalRecords: false,
  attachments: false,
  prescriptions: false,
  orders: false,
  appointments: false,
  hceSummary: false,
  templates: false,
};

/** Tab-scoped fetch plan — avoids ~9 parallel queries on every tab switch. */
export function getWorkspaceFetchPlan(tab: PatientWorkspaceTabId): WorkspaceFetchPlan {
  switch (tab) {
    case "auditoria":
    case "docs_admin":
      return LIGHT_SHELL;

    case "recetas":
      return {
        ...LIGHT_SHELL,
        prescriptions: true,
        clinicalRecords: true,
        recordLimit: 50,
        hceSummary: false,
      };

    case "ordenes":
      return {
        ...LIGHT_SHELL,
        orders: true,
        clinicalRecords: true,
        recordLimit: 50,
      };

    case "diagnosticos":
      return {
        ...LIGHT_SHELL,
        clinicalRecords: true,
        recordLimit: 100,
        hceSummary: true,
      };

    case "soap":
      return {
        clinicalRecords: true,
        attachments: true,
        prescriptions: true,
        orders: false,
        appointments: false,
        hceSummary: true,
        templates: true,
        recordLimit: PATIENT_EHR_RECORD_LIMIT,
      };

    case "timeline":
      return TIMELINE;

    case "resumen":
      return {
        ...TIMELINE,
        templates: false,
        recordLimit: PATIENT_EHR_RECORD_PAGE_SIZE,
      };

    case "problemas":
    case "alergias":
    case "medicacion":
    case "estudios":
    case "archivos":
    case "vacunas":
      return {
        ...LIGHT_SHELL,
        clinicalRecords: true,
        attachments: true,
        prescriptions: true,
        recordLimit: 100,
        hceSummary: true,
      };

    default:
      return TIMELINE;
  }
}
