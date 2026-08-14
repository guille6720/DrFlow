import Link from "next/link";

import { PatientEhrClinicalTables } from "@/features/historias/components/historias/patient-ehr-clinical-tables";
import { PatientProblemListPanel } from "@/features/historias/components/historias/patient-problem-list-panel";
import { patientWorkspacePath } from "@/features/pacientes/constants/patient-workspace-tabs";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";

import { Card } from "@/components/ui/card";

type Props = {
  ehr: PatientEhrWorkspaceData;
  patientId: string;
};

export function PatientWorkspaceDiagnosticsPanel({ ehr, patientId }: Props) {
  return (
    <Card title="Diagnósticos">
      <PatientProblemListPanel patientId={patientId} problems={ehr.problemList} />
      <PatientEhrClinicalTables
        patientId={patientId}
        diagnosisRows={ehr.diagnosisRows}
        treatmentRows={ehr.treatmentRows}
        showDiagnostics
        showTreatments={false}
      />
      <Link
        href={patientWorkspacePath(patientId, "soap")}
        className="mt-4 inline-block text-sm text-teal-700 hover:underline"
      >
        Ver consultas SOAP →
      </Link>
    </Card>
  );
}
