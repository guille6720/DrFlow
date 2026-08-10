"use client";

import { ClinicalWorkspaceAiSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-ai-section";
import { ClinicalWorkspaceAlertsStrip } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-alerts-strip";
import { ClinicalWorkspaceHeader } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-header";
import { ClinicalWorkspaceLastConsultSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-last-consult-section";
import { ClinicalWorkspaceMedicationsSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-medications-section";
import { ClinicalWorkspaceProblemsSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-problems-section";
import { ClinicalWorkspaceStudiesSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-studies-section";
import { ClinicalWorkspaceTimelinePreview } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-timeline-preview";
import { ClinicalWorkspaceVitalsSection } from "@/features/pacientes/components/pacientes/clinical-workspace/clinical-workspace-vitals-section";
import { PamiPatientBanner } from "@/features/pacientes/components/pacientes/pami-patient-banner";
import type { PatientChartViewProps } from "@/features/pacientes/components/pacientes/patient-chart-view-types";
import type { PatientEhrWorkspaceData } from "@/features/pacientes/server/load-patient-ehr-data";
import {
  buildClinicalWorkspaceAlerts,
  buildLastConsultSummary,
} from "@/features/pacientes/utils/clinical-workspace-alerts";

export type ClinicalWorkspaceViewProps = PatientChartViewProps & {
  ehr: PatientEhrWorkspaceData;
  lastEvolution?: string | null;
  lastDiagnosis?: string | null;
};

/** Single-screen clinical workspace — 10-second situational awareness. */
export function ClinicalWorkspaceView({
  patient,
  chart,
  patientId,
  canEditClinical,
  canIssue,
  professionals,
  appointments,
  ehr,
  lastEvolution,
  lastDiagnosis,
}: ClinicalWorkspaceViewProps) {
  const alerts = buildClinicalWorkspaceAlerts(chart);
  const lastRx = ehr.prescriptions.slice(0, 3).map((rx) => rx.label);
  const lastOrders = ehr.orders.slice(0, 3).map((o) => o.order_text.slice(0, 40));
  const lastConsult = buildLastConsultSummary(ehr.consultations[0], lastRx, lastOrders);
  const patientName = `${patient.last_name}, ${patient.first_name}`;

  return (
    <div className="drflow-clinical-workspace" aria-label="Espacio clínico del paciente">
      <PamiPatientBanner patient={patient} />

      <ClinicalWorkspaceHeader
        patient={patient}
        chart={chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
        canIssue={canIssue}
        appointments={appointments}
        professionals={professionals}
      />

      <ClinicalWorkspaceAlertsStrip alerts={alerts} />

      <div className="drflow-clinical-workspace-grid">
        <div className="drflow-clinical-workspace-col-main">
          <ClinicalWorkspaceProblemsSection
            chart={chart}
            patientId={patientId}
            canEditClinical={canEditClinical}
          />
          <ClinicalWorkspaceMedicationsSection
            chart={chart}
            patientId={patientId}
            filteredMeds={chart.medications}
          />
          <ClinicalWorkspaceVitalsSection
            chart={chart}
            patientId={patientId}
            canEditClinical={canEditClinical}
          />
          <ClinicalWorkspaceLastConsultSection summary={lastConsult} />
        </div>

        <div className="drflow-clinical-workspace-col-side">
          <ClinicalWorkspaceStudiesSection chart={chart} patientId={patientId} />
          <ClinicalWorkspaceTimelinePreview ehr={ehr} patientId={patientId} />
          <ClinicalWorkspaceAiSection
            chart={chart}
            patient={patient}
            patientId={patientId}
            ehr={ehr}
            patientName={patientName}
            lastEvolution={lastEvolution}
            lastDiagnosis={lastDiagnosis}
          />
        </div>
      </div>
    </div>
  );
}
