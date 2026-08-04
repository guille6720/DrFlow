"use client";

import { MedicalOrderForm } from "@/components/recetas/medical-order-form";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";

type Professional = {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
};

type Props = {
  open: boolean;
  patientId: string;
  patientName: string;
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
      />
    </PatientWorkspaceOverlay>
  );
}
