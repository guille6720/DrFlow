import type { PatientChartViewProps } from "@/components/pacientes/patient-chart-types";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";
import type { Patient } from "@/types/database";

export type ClinicalTemplateRow = {
  id: string;
  name: string;
  chief_complaint_template: string | null;
  diagnosis_template: string | null;
  evolution_template: string | null;
  indications_template: string | null;
};

export type PatientWorkspaceViewProps = PatientChartViewProps & {
  ehr: PatientEhrWorkspaceData;
  initialTab?: PatientWorkspaceTabId;
  templates: ClinicalTemplateRow[];
  patientRecord: Patient;
};
