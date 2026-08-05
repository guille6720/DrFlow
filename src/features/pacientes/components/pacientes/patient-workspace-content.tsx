import { PatientArcoExportButton } from "@/core/components/legal/patient-arco-export-button";
import { createClient } from "@/core/supabase/server";

import { PatientEhrView } from "@/features/historias/components/historias/patient-ehr-view";
import { ClinicalWorkspaceView } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-view";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientWorkspaceChartPanel } from "@/features/pacientes/components/pacientes/patient-workspace-chart-panel";
import { PatientWorkspaceDiagnosticsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-diagnostics-panel";
import { PatientWorkspaceOrdersPanel } from "@/features/pacientes/components/pacientes/patient-workspace-orders-panel";
import { PatientWorkspacePrescriptionsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-prescriptions-panel";
import { PatientWorkspaceTimelinePanel } from "@/features/pacientes/components/pacientes/patient-workspace-timeline-panel";
import { PatientWorkspaceView } from "@/features/pacientes/components/pacientes/patient-workspace-view";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { loadPatientWorkspacePageData } from "@/features/pacientes/server/load-patient-workspace-page";
import { chartFocusForTab } from "@/features/pacientes/utils/patient-workspace-tab-routing";

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

  const resumenPanel =
    initialTab === "resumen" ? (
      <ClinicalWorkspaceView
        patient={workspace.patient}
        chart={workspace.chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
        canIssue={canIssue}
        professionals={workspace.professionals}
        lastMedications={workspace.lastMedications}
        clinicalDocuments={workspace.clinicalDocuments}
        appointments={workspace.appointments}
        portalSlug={workspace.portalSlug}
        doctorInfo={workspace.doctorInfo}
        patientShare={workspace.patientShare}
        regularMedication={workspace.patient.regular_medication}
        ehr={workspace.ehr}
        lastEvolution={workspace.ehr.consultations[0]?.evolution}
        lastDiagnosis={workspace.ehr.diagnosisRows[0]?.name}
      />
    ) : undefined;

  const soapPanel =
    initialTab === "soap" ? (
      <PatientEhrView
        embedded
        patient={workspace.ehr.patientInfo}
        consultations={workspace.ehr.consultations}
        diagnosisRows={workspace.ehr.diagnosisRows}
        treatmentRows={workspace.ehr.treatmentRows}
        attachments={workspace.ehr.attachments}
        prescriptions={workspace.ehr.prescriptions}
        totalConsultations={workspace.ehr.totalConsultations}
        usesHceExport={workspace.ehr.usesHceExport}
      />
    ) : undefined;

  const diagnosticosPanel =
    initialTab === "diagnosticos" ? (
      <PatientWorkspaceDiagnosticsPanel ehr={workspace.ehr} patientId={patientId} />
    ) : undefined;

  const recetasPanel =
    initialTab === "recetas" ? (
      <PatientWorkspacePrescriptionsPanel
        ehr={workspace.ehr}
        patientId={patientId}
        canIssue={canIssue}
      />
    ) : undefined;

  const ordenesPanel =
    initialTab === "ordenes" ? (
      <PatientWorkspaceOrdersPanel ehr={workspace.ehr} patientId={patientId} canIssue={canIssue} />
    ) : undefined;

  const timelinePanel =
    initialTab === "timeline" ? <PatientWorkspaceTimelinePanel ehr={workspace.ehr} /> : undefined;

  const chartFocus = chartFocusForTab(initialTab);
  const chartPanel = chartFocus ? (
    <PatientWorkspaceChartPanel
      focus={chartFocus}
      patient={workspace.patient}
      chart={workspace.chart}
      patientId={patientId}
      canEditClinical={canEditClinical}
      canIssue={canIssue}
      professionals={workspace.professionals}
      lastMedications={workspace.lastMedications}
      regularMedication={workspace.patient.regular_medication}
      clinicalDocuments={workspace.clinicalDocuments}
    />
  ) : undefined;

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
      resumenPanel={resumenPanel}
      soapPanel={soapPanel}
      diagnosticosPanel={diagnosticosPanel}
      recetasPanel={recetasPanel}
      ordenesPanel={ordenesPanel}
      timelinePanel={timelinePanel}
      chartPanel={chartPanel}
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
