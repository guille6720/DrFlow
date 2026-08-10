import { PatientArcoExportButton } from "@/core/components/legal/patient-arco-export-button";
import { createClient } from "@/core/supabase/server";

import { ClinicalWorkspaceView } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-view";
import type { PatientChartPatient } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import { PatientSoapWorkspace } from "@/features/pacientes/components/pacientes/patient-soap-workspace";
import { PatientWorkspaceAdminDocsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-admin-docs-panel";
import { PatientWorkspaceChartPanel } from "@/features/pacientes/components/pacientes/patient-workspace-chart-panel";
import { PatientWorkspaceDiagnosticsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-diagnostics-panel";
import { PatientWorkspaceOrdersPanel } from "@/features/pacientes/components/pacientes/patient-workspace-orders-panel";
import { PatientWorkspacePrescriptionsPanel } from "@/features/pacientes/components/pacientes/patient-workspace-prescriptions-panel";
import { PatientWorkspaceTimelinePanel } from "@/features/pacientes/components/pacientes/patient-workspace-timeline-panel";
import { PatientWorkspaceView } from "@/features/pacientes/components/pacientes/patient-workspace-view";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { loadPatientAuditTrail } from "@/features/pacientes/server/load-patient-audit-trail";
import { loadPatientWorkspacePageData } from "@/features/pacientes/server/load-patient-workspace-page";
import { chartFocusForTab } from "@/features/pacientes/utils/patient-workspace-tab-routing";

type Props = {
  clinicId: string;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
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
  canManageAdminDocuments: boolean;
};

export async function PatientWorkspaceContent({
  clinicId,
  clinic,
  patient,
  patientRecord,
  patientId,
  initialTab,
  canEditClinical,
  canIssue,
  canManagePatients,
  canManageAdminDocuments,
}: Props) {
  const supabase = await createClient();
  const [workspace, auditTrail] = await Promise.all([
    loadPatientWorkspacePageData(supabase, clinicId, patient, initialTab),
    initialTab === "auditoria" ? loadPatientAuditTrail(patientId) : Promise.resolve(null),
  ]);

  const adminDocuments =
    initialTab === "docs_admin" && canManageAdminDocuments
      ? (
          await supabase
            .from("patient_admin_documents")
            .select("id, title, file_name, category, created_at")
            .eq("clinic_id", clinicId)
            .eq("patient_id", patientId)
            .order("created_at", { ascending: false })
            .limit(50)
        ).data ?? []
      : [];

  const resumenPanel =
    initialTab === "resumen" ? (
      <ClinicalWorkspaceView
        patient={workspace.patient}
        chart={workspace.chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
      canIssue={canIssue}
      professionals={workspace.professionals}
      defaultProfessionalId={workspace.defaultProfessionalId}
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
      <PatientSoapWorkspace
        embedded
        patient={workspace.ehr.patientInfo}
        consultations={workspace.ehr.consultations}
        diagnosisRows={workspace.ehr.diagnosisRows}
        treatmentRows={workspace.ehr.treatmentRows}
        attachments={workspace.ehr.attachments}
        prescriptions={workspace.ehr.prescriptions}
        totalConsultations={workspace.ehr.totalConsultations}
        usesHceExport={workspace.ehr.usesHceExport}
        patientRecord={patientRecord}
        professionals={workspace.professionals}
        templates={workspace.templates}
        defaultProfessionalId={workspace.defaultProfessionalId}
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
        patient={patient}
        clinic={clinic}
        professionals={workspace.professionals}
        canIssue={canIssue}
      />
    ) : undefined;

  const ordenesPanel =
    initialTab === "ordenes" ? (
      <PatientWorkspaceOrdersPanel
        ehr={workspace.ehr}
        patientId={patientId}
        patient={patient}
        clinic={clinic}
        professionals={workspace.professionals}
        canIssue={canIssue}
      />
    ) : undefined;

  const timelinePanel =
    initialTab === "timeline" ? <PatientWorkspaceTimelinePanel ehr={workspace.ehr} /> : undefined;

  const docsAdminPanel =
    initialTab === "docs_admin" && canManageAdminDocuments ? (
      <PatientWorkspaceAdminDocsPanel
        patientId={patientId}
        patientLabel={`${patient.last_name}, ${patient.first_name} — ${patient.document_number}`}
        documents={adminDocuments}
      />
    ) : undefined;

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
      defaultProfessionalId={workspace.defaultProfessionalId}
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
      defaultProfessionalId={workspace.defaultProfessionalId}
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
      docsAdminPanel={docsAdminPanel}
      timelinePanel={timelinePanel}
      chartPanel={chartPanel}
      canManageAdminDocuments={canManageAdminDocuments}
      initialAuditEvents={auditTrail?.data}
      initialAuditError={auditTrail?.error ?? null}
      initialAuditNextCursor={auditTrail?.nextCursor ?? null}
      initialAuditHasMore={auditTrail?.hasMore ?? false}
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
