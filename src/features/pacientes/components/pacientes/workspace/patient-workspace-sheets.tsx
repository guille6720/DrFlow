"use client";

import { CloseEncounterWizardSheet } from "@/features/ia/components/clinical-workflow/close-encounter-wizard-sheet";
import type { PatientWorkspaceViewProps } from "@/features/pacientes/components/pacientes/patient-workspace-types";
import { PatientConsultSheet } from "@/features/pacientes/components/pacientes/workspace/patient-consult-sheet";
import { PatientDocumentAssistSheet } from "@/features/pacientes/components/pacientes/workspace/patient-document-assist-sheet";
import { PatientLabInterpretSheet } from "@/features/pacientes/components/pacientes/workspace/patient-lab-interpret-sheet";
import { PatientOrderSheet } from "@/features/pacientes/components/pacientes/workspace/patient-order-sheet";
import { PatientPrescriptionSheet } from "@/features/pacientes/components/pacientes/workspace/patient-prescription-sheet";
import { PatientRecordSheet } from "@/features/pacientes/components/pacientes/workspace/patient-record-sheet";
import type { PatientWorkspaceTabId } from "@/features/pacientes/constants/patient-workspace-tabs";
import { usePatientWorkspaceActions } from "@/features/pacientes/hooks/use-patient-workspace-actions";

import type { Patient } from "@/types/database";

type Props = Pick<
  PatientWorkspaceViewProps,
  | "patient"
  | "patientId"
  | "ehr"
  | "professionals"
  | "defaultProfessionalId"
  | "lastMedications"
  | "templates"
  | "canIssue"
  | "chart"
> & {
  activeTab: PatientWorkspaceTabId;
  patientRecord: Patient;
};

export function PatientWorkspaceSheets({
  activeTab,
  patient,
  patientId,
  patientRecord,
  ehr,
  professionals,
  defaultProfessionalId,
  lastMedications,
  templates,
  canIssue,
  chart,
}: Props) {
  const actions = usePatientWorkspaceActions(patientId, activeTab);
  const patientName = `${patient.last_name}, ${patient.first_name}`;
  const lastConsult = ehr.consultations[0];
  const assistBase = {
    patientName,
    allergies: patientRecord.allergies,
    regularMedication: patientRecord.regular_medication,
    medicalHistory: patientRecord.medical_history,
    lastEvolution: lastConsult?.evolution ?? null,
    lastDiagnosis: lastConsult?.diagnosis ?? ehr.diagnosisRows[0]?.name ?? null,
    activeProblems: ehr.diagnosisRows.map((d) => d.name).slice(0, 6),
    insurance: patient.insurance_provider ?? undefined,
    insurancePlan: patientRecord.insurance_plan,
    chiefComplaint: lastConsult?.chief_complaint ?? null,
    diagnosis: lastConsult?.diagnosis ?? null,
    evolutionText: lastConsult?.evolution ?? undefined,
  };

  const selectedRecord = actions.record
    ? ehr.consultations.find((c) => c.id === actions.record) ?? null
    : null;

  return (
    <>
      <PatientConsultSheet
        open={actions.consultSheetOpen}
        patient={patientRecord}
        patients={[patientRecord]}
        professionals={professionals}
        templates={templates}
        canIssuePrescriptions={canIssue}
        appointmentId={actions.appointment}
        professionalId={actions.professional ?? defaultProfessionalId}
        lastMedications={lastMedications}
        onClose={actions.closeSheet}
        onSaved={actions.onConsultSaved}
      />

      <PatientPrescriptionSheet
        open={actions.prescriptionSheetOpen && canIssue}
        patientId={patientId}
        patientInsurance={patient.insurance_provider}
        patientName={patientName}
        professionals={professionals}
        defaultProfessionalId={actions.professional ?? defaultProfessionalId ?? undefined}
        clinicalRecordId={actions.consulta ?? undefined}
        initialMedications={lastMedications ?? undefined}
        onClose={actions.closeSheet}
        onSaved={actions.onRxOrOrderSaved}
      />

      <PatientOrderSheet
        open={actions.orderSheetOpen && canIssue}
        patientId={patientId}
        patientName={patientName}
        patientInsurance={patient.insurance_provider}
        patientInsurancePlan={patientRecord.insurance_plan}
        patientAllergies={patientRecord.allergies}
        patientRegularMedication={patientRecord.regular_medication}
        lastDiagnosis={assistBase.lastDiagnosis}
        lastEvolution={assistBase.lastEvolution}
        professionals={professionals}
        defaultProfessionalId={actions.professional ?? defaultProfessionalId ?? undefined}
        clinicalRecordId={actions.consulta ?? undefined}
        onClose={actions.closeSheet}
        onSaved={actions.onRxOrOrderSaved}
      />

      <PatientRecordSheet
        open={actions.recordSheetOpen}
        patientId={patientId}
        record={selectedRecord}
        mode={actions.mode}
        onClose={actions.closeSheet}
      />

      <PatientDocumentAssistSheet
        open={actions.dischargeSheetOpen}
        kind="discharge_summary"
        title="Resumen de alta"
        patientName={patientName}
        context={assistBase}
        onClose={actions.closeSheet}
      />

      <PatientDocumentAssistSheet
        open={actions.certificateSheetOpen}
        kind="medical_certificate"
        title="Certificado médico"
        patientName={patientName}
        context={assistBase}
        onClose={actions.closeSheet}
      />

      <CloseEncounterWizardSheet
        open={actions.closeEncounterSheetOpen && canIssue}
        patientName={patientName}
        context={assistBase}
        onClose={actions.closeSheet}
      />

      <PatientLabInterpretSheet
        open={actions.labInterpretSheetOpen}
        patientName={patientName}
        previousLabs={chart.extras.labs}
        onClose={actions.closeSheet}
      />
    </>
  );
}
