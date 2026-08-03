import type { PatientChartViewProps } from "@/components/pacientes/patient-chart-types";
import type { PatientEhrWorkspaceData } from "@/lib/server/load-patient-ehr-data";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";

export type PatientWorkspaceViewProps = PatientChartViewProps & {
  ehr: PatientEhrWorkspaceData;
  initialTab?: PatientWorkspaceTabId;
};
