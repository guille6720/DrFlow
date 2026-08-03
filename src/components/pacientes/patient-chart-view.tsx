"use client";

import { PatientChartGridPrimary } from "@/components/pacientes/patient-chart-grid-primary";
import { PatientChartGridSecondary } from "@/components/pacientes/patient-chart-grid-secondary";
import { PatientChartStickyBar } from "@/components/pacientes/patient-chart-sticky-bar";
import { PatientChartSummary } from "@/components/pacientes/patient-chart-summary";
import type { PatientChartViewProps } from "@/components/pacientes/patient-chart-types";
import { usePatientChartMedicationFilter } from "@/lib/hooks/use-patient-chart";

export type { AppointmentRow } from "@/components/pacientes/patient-chart-types";

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
}: PatientChartViewProps) {
  const { medSearch, setMedSearch, filteredMeds } = usePatientChartMedicationFilter(chart);

  return (
    <div className="drflow-patient-chart">
      <PatientChartStickyBar patientId={patientId} arcoExport={arcoExport} />

      <PatientChartSummary
        patient={patient}
        chart={chart}
        patientId={patientId}
        canEditClinical={canEditClinical}
      />

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
