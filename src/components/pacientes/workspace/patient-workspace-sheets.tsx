"use client";

import { PatientConsultSheet } from "@/components/pacientes/workspace/patient-consult-sheet";
import { PatientOrderSheet } from "@/components/pacientes/workspace/patient-order-sheet";
import { PatientPrescriptionSheet } from "@/components/pacientes/workspace/patient-prescription-sheet";
import { PatientRecordSheet } from "@/components/pacientes/workspace/patient-record-sheet";
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
}: Props) {
  const actions = usePatientWorkspaceActions(patientId, activeTab);
  const patientName = `${patient.last_name}, ${patient.first_name}`;

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
        onClose={actions.closeSheet}
        onSaved={actions.onConsultSaved}
      />

      <PatientPrescriptionSheet
        open={actions.prescriptionSheetOpen && canIssue}
        patientId={patientId}
        patientInsurance={patient.insurance_provider}
        patientName={patientName}
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
    </>
  );
}
