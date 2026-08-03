export { PatientsListCards } from "@/components/pacientes/patients-list-cards";
export { PatientWorkspaceContent } from "@/components/pacientes/patient-workspace-content";
export { PatientWorkspaceSkeleton } from "@/components/pacientes/patient-workspace-skeleton";
export { PatientAdminDetailView } from "@/components/pacientes/patient-admin-detail-view";
export { PatientClinicalAssistantPanel } from "@/components/pacientes/patient-clinical-assistant-panel";
export {
  PATIENT_WORKSPACE_TABS,
  patientWorkspacePath,
  parsePatientWorkspaceTab,
} from "@/lib/constants/patient-workspace-tabs";
export { loadPatientWorkspacePageData } from "@/lib/server/load-patient-workspace-page";
export { createPatient, updatePatient } from "@/lib/actions/patients";
