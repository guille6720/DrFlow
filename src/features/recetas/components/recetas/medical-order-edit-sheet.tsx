"use client";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { MedicalOrderForm } from "@/features/recetas/components/recetas/medical-order-form";

import type { MedicalOrderEditFields } from "@/types/medical-order";

type Professional = {
  id: string;
  license_number?: string | null;
  display_name?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

type Props = {
  open: boolean;
  order: MedicalOrderEditFields | null;
  patientId: string;
  professionals: Professional[];
  onClose: () => void;
  onSaved?: () => void;
};

export function MedicalOrderEditSheet({
  open,
  order,
  patientId,
  professionals,
  onClose,
  onSaved,
}: Props) {
  if (!order) return null;

  function handleSaved() {
    onSaved?.();
    onClose();
  }

  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Editar orden médica"
      subtitle="Modificá el texto, indicaciones o profesional firmante."
      onClose={onClose}
      wide
    >
      <MedicalOrderForm
        key={order.id}
        patientId={patientId}
        clinicalRecordId={order.clinical_record_id ?? undefined}
        professionals={professionals}
        existingOrder={order}
        onSuccess={handleSaved}
        onCancel={onClose}
      />
    </PatientWorkspaceOverlay>
  );
}
