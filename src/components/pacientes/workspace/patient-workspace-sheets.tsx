"use client";

import { PatientConsultSheet } from "@/components/pacientes/workspace/patient-consult-sheet";
import { PatientDocumentAssistSheet } from "@/components/pacientes/workspace/patient-document-assist-sheet";
import { PatientLabInterpretSheet } from "@/components/pacientes/workspace/patient-lab-interpret-sheet";
import { PatientOrderSheet } from "@/components/pacientes/workspace/patient-order-sheet";
import { PatientPrescriptionSheet } from "@/components/pacientes/workspace/patient-prescription-sheet";
import { PatientRecordSheet } from "@/components/pacientes/workspace/patient-record-sheet";
import { CloseEncounterWizardSheet } from "@/components/clinical-workflow/close-encounter-wizard-sheet";
import type { PatientWorkspaceViewProps } from "@/components/pacientes/patient-workspace-types";
import type { PatientWorkspaceTabId } from "@/lib/constants/patient-workspace-tabs";
import { usePatientWorkspaceActions } from "@/lib/hooks/use-patient-workspace-actions";
import type { Patient } from "@/types/database";

type Props = Pick<
  PatientWorkspaceViewProps,
  | "patient"
  | "patientId"
  | "ehr"
  | "professionals"
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
        professionalId={actions.professional}
        lastMedications={lastMedications}
        onClose={actions.closeSheet}
        onSaved={actions.onConsultSaved}
      />

      <PatientPrescriptionSheet
        open={actions.prescriptionSheetOpen && canIssue}
        patientId={patientId}
        patientInsurance={patient.insurance_provider}
        patientInsurancePlan={patientRecord.insurance_plan}
        patientName={patientName}
        patientAllergies={patientRecord.allergies}
        patientRegularMedication={patientRecord.regular_medication}
        professionals={professionals}
        defaultProfessionalId={actions.professional ?? undefined}
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
        defaultProfessionalId={actions.professional ?? undefined}
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
