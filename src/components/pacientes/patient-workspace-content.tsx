import { PatientWorkspaceView } from "@/components/pacientes/patient-workspace-view";
import type { PatientChartPatient } from "@/components/pacientes/patient-chart-types";
import { PatientArcoExportButton } from "@/components/legal/patient-arco-export-button";
import { loadPatientWorkspacePageData } from "@/lib/server/load-patient-workspace-page";
import { createClient } from "@/lib/supabase/server";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";

type Props = {
  clinicId: string;
  patient: PatientChartPatient & {
    medical_history: string | null;
    allergies: string | null;
    regular_medication: string | null;
    notes: string | null;
  };
  patientId: string;
  initialTab: PatientWorkspaceTabId;
  canEditClinical: boolean;
  canIssue: boolean;
  canManagePatients: boolean;
};

export async function PatientWorkspaceContent({
  clinicId,
  patient,
  patientId,
  initialTab,
  canEditClinical,
  canIssue,
  canManagePatients,
}: Props) {
  const supabase = await createClient();
  const workspace = await loadPatientWorkspacePageData(supabase, clinicId, patient);

  return (
    <PatientWorkspaceView
      initialTab={initialTab}
      ehr={workspace.ehr}
      patient={patient}
      patientId={patientId}
      chart={workspace.chart}
      canEditClinical={canEditClinical}
      canIssue={canIssue}
      professionals={workspace.professionals}
      lastMedications={workspace.lastMedications}
      regularMedication={patient.regular_medication}
      clinicalDocuments={workspace.clinicalDocuments}
      appointments={workspace.appointments}
      portalSlug={workspace.portalSlug}
      doctorInfo={workspace.doctorInfo}
      patientShare={workspace.patientShare}
      arcoExport={
        canManagePatients ? (
          <PatientArcoExportButton
            patientId={patient.id}
            fileLabel={`${patient.document_number}`}
          />
        ) : undefined
      }
    />
  );
}
