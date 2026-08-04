import { buildPatientWorkspaceUrl } from "@/lib/utils/patient-workspace-actions";

const PATIENT_PATH = /^\/pacientes\/([^/]+)/;

export function parsePatientIdFromPath(pathname: string): string | null {
  const match = PATIENT_PATH.exec(pathname);
  if (!match) return null;
  const id = match[1];
  if (id === "nuevo") return null;
  return id;
}

export type PatientWorkflowAction = "soap" | "prescription" | "order" | "chart";

export function patientWorkflowHref(patientId: string, action: PatientWorkflowAction): string {
  switch (action) {
    case "soap":
      return buildPatientWorkspaceUrl(patientId, { tab: "soap", action: "nueva" });
    case "prescription":
      return buildPatientWorkspaceUrl(patientId, { tab: "recetas", action: "nueva" });
    case "order":
      return buildPatientWorkspaceUrl(patientId, { tab: "ordenes", action: "nueva" });
    case "chart":
      return `/pacientes/${patientId}`;
  }
}

/** Click budget targets for workflow optimization (mouse-driven paths). */
export const WORKFLOW_CLICK_TARGETS = {
  searchPatient: 2,
  createSoap: 1,
  prescription: 1,
  medicalOrder: 1,
  closeConsultation: 1,
} as const;

export const WORKFLOW_CLICK_BEFORE = {
  searchPatient: 4,
  createSoap: 3,
  prescription: 4,
  medicalOrder: 4,
  closeConsultation: 3,
} as const;

export function workflowClickReduction(
  workflow: keyof typeof WORKFLOW_CLICK_TARGETS
): { before: number; after: number; saved: number; pct: number } {
  const after = WORKFLOW_CLICK_TARGETS[workflow];
  const before = WORKFLOW_CLICK_BEFORE[workflow];
  const saved = before - after;
  return { before, after, saved, pct: Math.round((saved / before) * 100) };
}
