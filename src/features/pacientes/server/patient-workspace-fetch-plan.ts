import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";

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

const FULL: WorkspaceFetchPlan = {
  clinicalRecords: true,
  attachments: true,
  prescriptions: true,
  orders: true,
  appointments: true,
  hceSummary: true,
  templates: true,
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
        recordLimit: 200,
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
        recordLimit: 500,
      };

    case "timeline":
      return FULL;

    case "resumen":
      return {
        ...FULL,
        recordLimit: 200,
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
        recordLimit: 150,
        hceSummary: true,
      };

    default:
      return FULL;
  }
}
