"use client";

import { ClinicalSummaryPhysicianAssist } from "@/features/ia/components/clinical-workflow/clinical-summary-physician-assist";
import { ClinicalWorkspaceView } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-view";
import { PatientChartGridPrimary } from "@/features/pacientes/components/pacientes/patient-chart-grid-primary";
import { PatientChartGridSecondary } from "@/features/pacientes/components/pacientes/patient-chart-grid-secondary";
import { PatientChartStickyBar } from "@/features/pacientes/components/pacientes/patient-chart-sticky-bar";
import { PatientChartSummary } from "@/features/pacientes/components/pacientes/patient-chart-summary";
import type { PatientChartViewProps } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import { usePatientChartMedicationFilter } from "@/features/pacientes/hooks/use-patient-chart";

export type { AppointmentRow } from "@/features/pacientes/components/pacientes/patient-chart-view-types";

export function PatientChartView({
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  professionals,
  lastMedications,
  clinicalDocuments,
  appointments,
  portalSlug,
  doctorInfo,
  patientShare,
  arcoExport,
  regularMedication,
  workspaceMode = false,
  lastEvolution,
  lastDiagnosis,
  ehr,
}: PatientChartViewProps & {
  lastEvolution?: string | null;
  lastDiagnosis?: string | null;
  ehr?: PatientEhrWorkspaceData;
}) {
  const { medSearch, setMedSearch, filteredMeds } = usePatientChartMedicationFilter(chart);

  if (workspaceMode && ehr) {
    return (
      <ClinicalWorkspaceView
        patient={patient}
        chart={chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
        canIssue={canIssue}
        professionals={professionals}
        lastMedications={lastMedications}
        clinicalDocuments={clinicalDocuments}
        appointments={appointments}
        portalSlug={portalSlug}
        doctorInfo={doctorInfo}
        patientShare={patientShare}
        regularMedication={regularMedication}
        ehr={ehr}
        lastEvolution={lastEvolution}
        lastDiagnosis={lastDiagnosis}
      />
    );
  }

  return (
    <div className="drflow-patient-chart">
      {!workspaceMode ? (
        <PatientChartStickyBar patientId={patientId} arcoExport={arcoExport} />
      ) : null}

      <PatientChartSummary
        patient={patient}
        chart={chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
      />

      {workspaceMode ? (
        <ClinicalSummaryPhysicianAssist
          chart={chart}
          patientName={`${patient.last_name}, ${patient.first_name}`}
          lastEvolution={lastEvolution}
          lastDiagnosis={lastDiagnosis}
        />
      ) : null}

      <div className="drflow-patient-chart-grid">
        <PatientChartGridPrimary
          patient={patient}
          chart={chart}
          patientId={patientId}
          canEditClinical={canEditClinical}
          canIssue={canIssue}
          professionals={professionals}
          lastMedications={lastMedications}
          regularMedication={regularMedication}
          medSearch={medSearch}
          setMedSearch={setMedSearch}
          filteredMeds={filteredMeds}
        />
        <PatientChartGridSecondary
          patient={patient}
          chart={chart}
          patientId={patientId}
          canEditClinical={canEditClinical}
          appointments={appointments}
          clinicalDocuments={clinicalDocuments}
          portalSlug={portalSlug}
          doctorInfo={doctorInfo}
          patientShare={patientShare}
        />
      </div>
    </div>
  );
}
