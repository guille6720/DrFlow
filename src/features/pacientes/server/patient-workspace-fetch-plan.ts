import { PATIENT_ATTACHMENTS_LIMIT } from "@/core/supabase/pagination";

import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import {
  PATIENT_EHR_INITIAL_APPOINTMENT_LIMIT,
  PATIENT_EHR_INITIAL_ATTACHMENT_LIMIT,
  PATIENT_EHR_INITIAL_LIMIT,
  PATIENT_EHR_INITIAL_ORDER_LIMIT,
  PATIENT_EHR_INITIAL_RX_LIMIT,
  PATIENT_RX_FETCH_LIMIT,
} from "@/features/pacientes/server/load-patient-ehr-data";

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
  attachmentLimit?: number;
  prescriptionLimit?: number;
  orderLimit?: number;
  appointmentLimit?: number;
};

/** Default landing + timeline: last 20 evolutions, not a full HC dump. */
const FIRST_PAINT: WorkspaceFetchPlan = {
  clinicalRecords: true,
  attachments: true,
  prescriptions: true,
  orders: true,
  appointments: true,
  hceSummary: true,
  templates: false,
  recordLimit: PATIENT_EHR_INITIAL_LIMIT,
  attachmentLimit: PATIENT_EHR_INITIAL_ATTACHMENT_LIMIT,
  prescriptionLimit: PATIENT_EHR_INITIAL_RX_LIMIT,
  orderLimit: PATIENT_EHR_INITIAL_ORDER_LIMIT,
  appointmentLimit: PATIENT_EHR_INITIAL_APPOINTMENT_LIMIT,
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
        prescriptionLimit: PATIENT_RX_FETCH_LIMIT,
      };

    case "ordenes":
      return {
        ...LIGHT_SHELL,
        orders: true,
        orderLimit: 50,
      };

    case "diagnosticos":
    case "problemas":
      return {
        ...LIGHT_SHELL,
        clinicalRecords: true,
        recordLimit: PATIENT_EHR_INITIAL_LIMIT,
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
        recordLimit: PATIENT_EHR_INITIAL_LIMIT,
        attachmentLimit: PATIENT_ATTACHMENTS_LIMIT,
        prescriptionLimit: PATIENT_EHR_INITIAL_RX_LIMIT,
      };

    case "timeline":
    case "resumen":
      return FIRST_PAINT;

    case "alergias":
    case "vacunas":
      return {
        ...LIGHT_SHELL,
        hceSummary: true,
      };

    case "medicacion":
      return {
        ...LIGHT_SHELL,
        prescriptions: true,
        prescriptionLimit: PATIENT_EHR_INITIAL_RX_LIMIT,
        hceSummary: true,
      };

    case "estudios":
    case "archivos":
      return {
        ...LIGHT_SHELL,
        attachments: true,
        attachmentLimit: PATIENT_ATTACHMENTS_LIMIT,
        hceSummary: true,
      };

    default:
      return FIRST_PAINT;
  }
}
