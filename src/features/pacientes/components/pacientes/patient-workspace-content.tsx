import { PatientWorkspaceView } from "@/features/pacientes/components/pacientes/patient-workspace-view";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientArcoExportButton } from "@/core/components/legal/patient-arco-export-button";
import { loadPatientWorkspacePageData } from "@/features/pacientes/server/load-patient-workspace-page";
import { createClient } from "@/core/supabase/server";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";

type Props = {
  clinicId: string;
  patient: PatientChartPatient & {
    medical_history: string | null;
    allergies: string | null;
    regular_medication: string | null;
    notes: string | null;
  };
  patientRecord: import("@/types/database").Patient;
  patientId: string;
  initialTab: PatientWorkspaceTabId;
  canEditClinical: boolean;
  canIssue: boolean;
  canManagePatients: boolean;
};

export async function PatientWorkspaceContent({
  clinicId,
  patient,
  patientRecord,
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
      patient={workspace.patient}
      patientId={patientId}
      chart={workspace.chart}
      canEditClinical={canEditClinical}
      canIssue={canIssue}
      professionals={workspace.professionals}
      lastMedications={workspace.lastMedications}
      regularMedication={workspace.patient.regular_medication}
      clinicalDocuments={workspace.clinicalDocuments}
      appointments={workspace.appointments}
      portalSlug={workspace.portalSlug}
      doctorInfo={workspace.doctorInfo}
      patientShare={workspace.patientShare}
      templates={workspace.templates}
      patientRecord={patientRecord}
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
