"use client";

import type {
  PatientChartPatient,
  PatientChartProfessional,
} from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { ClinicalDocumentItem } from "@/features/historias/components/historias/clinical-documents-panel";
import type { PatientChartPayload } from "@/features/pacientes/utils/patient-chart-model-types";
import type { PrescriptionMedication } from "@/types/prescription";
import { usePatientChartMedicationFilter } from "@/features/pacientes/hooks/use-patient-chart";
import {
  PatientChartAllergiesPanel,
  PatientChartDocumentsPanel,
  PatientChartMedicationPanel,
  PatientChartProblemsPanel,
  PatientChartStudiesPanel,
  PatientChartVaccinesPanel,
  PatientChartVitalsPanel,
} from "@/features/pacientes/components/pacientes/patient-chart-focus-panels";

export type PatientChartFocus =
  | "problemas"
  | "medicacion"
  | "alergias"
  | "vitales"
  | "estudios"
  | "archivos"
  | "vacunas";

type Props = {
  focus: PatientChartFocus;
  patient: PatientChartPatient;
  chart: PatientChartPayload;
  patientId: string;
  canEditClinical: boolean;
  canIssue: boolean;
  professionals: PatientChartProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  regularMedication?: string | null;
  clinicalDocuments: ClinicalDocumentItem[];
};

export function PatientWorkspaceChartPanel(props: Props) {
  const { focus, chart, clinicalDocuments } = props;
  const { medSearch, setMedSearch, filteredMeds } = usePatientChartMedicationFilter(chart);

  switch (focus) {
    case "alergias":
      return <PatientChartAllergiesPanel {...props} />;
    case "problemas":
      return <PatientChartProblemsPanel {...props} />;
    case "medicacion":
      return (
        <PatientChartMedicationPanel
          {...props}
          medSearch={medSearch}
          setMedSearch={setMedSearch}
          filteredMeds={filteredMeds}
        />
      );
    case "vitales":
      return <PatientChartVitalsPanel {...props} />;
    case "estudios":
      return <PatientChartStudiesPanel chart={chart} />;
    case "vacunas":
      return <PatientChartVaccinesPanel chart={chart} />;
    case "archivos":
      return <PatientChartDocumentsPanel clinicalDocuments={clinicalDocuments} />;
    default:
      return null;
  }
}
