"use client";

import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";
import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";

type Professional = {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
};

type Props = {
  open: boolean;
  patientId: string;
  patientInsurance?: string | null;
  patientInsurancePlan?: string | null;
  patientName: string;
  patientAllergies?: string | null;
  patientRegularMedication?: string | null;
  lastDiagnosis?: string | null;
  lastEvolution?: string | null;
  professionals: Professional[];
  defaultProfessionalId?: string;
  clinicalRecordId?: string;
  onClose: () => void;
  onSaved: () => void;
};

export function PatientOrderSheet({
  open,
  patientId,
  patientName,
  patientInsurance,
  patientInsurancePlan,
  patientAllergies,
  patientRegularMedication,
  lastDiagnosis,
  lastEvolution,
  professionals,
  defaultProfessionalId,
  clinicalRecordId,
  onClose,
  onSaved,
}: Props) {
  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Nueva orden médica"
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      <MedicalOrderForm
        patientId={patientId}
        clinicalRecordId={clinicalRecordId}
        professionals={professionals}
        defaultProfessionalId={defaultProfessionalId}
        onSuccess={onSaved}
        assistContext={{
          patientName,
          allergies: patientAllergies,
          regularMedication: patientRegularMedication,
          lastDiagnosis,
          lastEvolution,
          insurance: patientInsurance ?? undefined,
          insurancePlan: patientInsurancePlan,
        }}
      />
    </PatientWorkspaceOverlay>
  );
}
