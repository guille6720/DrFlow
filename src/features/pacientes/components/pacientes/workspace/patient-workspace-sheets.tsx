"use client";

import { useCallback, useMemo, useState } from "react";

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
import type { PatientWorkspaceUrlOptions } from "@/features/pacientes/utils/patient-workspace-actions";
import {
  clearInlineConsultPrescriptionSnapshot,
  readInlineConsultPrescriptionSnapshot,
} from "@/features/recetas/utils/inline-consult-prescription-bridge";

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
  | "coverageRuleOverrides"
> & {
  activeTab: PatientWorkspaceTabId;
  patientRecord: Patient;
  clinic: {
    name: string;
    address?: string | null;
    phone?: string | null;
  };
  canEditClinical: boolean;
  workspaceNavigation: {
    workspaceSearchParams: URLSearchParams;
    navigateWorkspace: (opts: PatientWorkspaceUrlOptions) => void;
  };
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
  coverageRuleOverrides = {},
  workspaceNavigation,
  clinic,
  canEditClinical,
}: Props) {
  const actions = usePatientWorkspaceActions(patientId, activeTab, workspaceNavigation);
  const [prescriptionFormKey, setPrescriptionFormKey] = useState(0);
  const [rxPrefillGate, setRxPrefillGate] = useState<{ anchor: string; skip: boolean }>({
    anchor: "",
    skip: false,
  });
  const patientName = `${patient.last_name}, ${patient.first_name}`;
  const lastConsult = ehr.consultations[0];
  const assistBase = {
    patientName,
    allergies: patientRecord.allergies,
    regularMedication: patientRecord.regular_medication,
    medicalHistory: patientRecord.medical_history,
    lastEvolution: lastConsult?.evolution ?? null,
    lastDiagnosis: lastConsult?.diagnosis ?? ehr.diagnosisRows[0]?.name ?? null,
    activeProblems:
      ehr.problemList.length > 0
        ? ehr.problemList.map((p) => p.name).slice(0, 6)
        : ehr.diagnosisRows.map((d) => d.name).slice(0, 6),
    insurance: patient.insurance_provider ?? undefined,
    insurancePlan: patientRecord.insurance_plan,
    chiefComplaint: lastConsult?.chief_complaint ?? null,
    diagnosis: lastConsult?.diagnosis ?? null,
    evolutionText: lastConsult?.evolution ?? undefined,
  };

  const selectedRecord = actions.record
    ? ehr.consultations.find((c) => c.id === actions.record) ?? null
    : null;

  const selectedConsult = actions.consulta
    ? ehr.consultations.find((c) => c.id === actions.consulta) ?? null
    : null;

  const inlineSnapshot = useMemo(
    () =>
      actions.prescriptionSheetOpen
        ? readInlineConsultPrescriptionSnapshot(patientId, actions.appointment ?? undefined)
        : null,
    [actions.appointment, actions.prescriptionSheetOpen, patientId]
  );

  const prescriptionPrefillAnchor = actions.inlineConsultOpen
    ? `${actions.appointment ?? "inline"}:${actions.professional ?? ""}`
    : (actions.consulta ?? "historical");

  const skipPrescriptionPrefill =
    rxPrefillGate.anchor === prescriptionPrefillAnchor && rxPrefillGate.skip;

  const prefillDiagnosis = skipPrescriptionPrefill
    ? ""
    : inlineSnapshot?.diagnosis?.trim() ||
      selectedConsult?.diagnosis?.trim() ||
      assistBase.lastDiagnosis ||
      "";

  const prefillCie10 = skipPrescriptionPrefill
    ? ""
    : ehr.problemList.find((p) => p.cie10_code?.trim())?.cie10_code?.trim() ||
      (prefillDiagnosis.match(/CIE-10:\s*([A-Z0-9.]+)/i)?.[1] ?? "") ||
      "";

  const handlePrescriptionSaved = useCallback(() => {
    clearInlineConsultPrescriptionSnapshot(patientId, actions.appointment ?? undefined);
    setRxPrefillGate({ anchor: prescriptionPrefillAnchor, skip: true });
    setPrescriptionFormKey((key) => key + 1);
    actions.onRxOrOrderSaved();
  }, [actions, patientId, prescriptionPrefillAnchor]);

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
        key={prescriptionFormKey}
        open={actions.prescriptionSheetOpen && canIssue}
        patientId={patientId}
        patient={{
          id: patientId,
          first_name: patient.first_name,
          last_name: patient.last_name,
          document_number: patient.document_number,
          insurance_provider: patient.insurance_provider,
          insurance_number: patient.insurance_number,
          insurance_plan: patientRecord.insurance_plan,
        }}
        patientInsurance={patient.insurance_provider}
        patientName={patientName}
        patientAllergies={patientRecord.allergies}
        professionals={professionals}
        defaultProfessionalId={actions.professional ?? defaultProfessionalId ?? undefined}
        clinicalRecordId={actions.consulta ?? undefined}
        prefillDiagnosis={prefillDiagnosis}
        prefillCie10={prefillCie10}
        patientAddress={patient.address}
        patientPhone={patient.phone}
        clinic={clinic}
        onClose={actions.closeSheet}
        onSaved={handlePrescriptionSaved}
        coverageRuleOverrides={coverageRuleOverrides}
      />

      <PatientOrderSheet
        open={actions.orderSheetOpen && canIssue}
        patientId={patientId}
        patient={{
          first_name: patient.first_name,
          last_name: patient.last_name,
          document_number: patient.document_number,
          birth_date: patient.birth_date,
          insurance_provider: patient.insurance_provider,
          insurance_number: patient.insurance_number,
        }}
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
        clinic={clinic}
        onClose={actions.closeSheet}
        onSaved={actions.onRxOrOrderSaved}
      />

      <PatientRecordSheet
        open={actions.recordSheetOpen}
        patientId={patientId}
        record={selectedRecord}
        mode={actions.mode}
        onClose={actions.closeSheet}
        canEditClinical={canEditClinical}
        clinic={clinic}
        patient={{
          first_name: patient.first_name,
          last_name: patient.last_name,
          document_number: patient.document_number,
          birth_date: patient.birth_date,
        }}
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
