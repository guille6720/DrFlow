"use client";

import { PrescriptionForm } from "@/components/recetas/prescription-form";
import { PatientWorkspaceOverlay } from "@/components/pacientes/workspace/patient-workspace-overlay";
import type { PrescriptionMedication } from "@/types/prescription";

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
  patientName: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  clinicalRecordId?: string;
  prefillDiagnosis?: string;
  prefillCie10?: string;
  initialMedications?: PrescriptionMedication[];
  onClose: () => void;
  onSaved: () => void;
};

export function PatientPrescriptionSheet({
  open,
  patientId,
  patientInsurance,
  patientName,
  professionals,
  defaultProfessionalId,
  clinicalRecordId,
  prefillDiagnosis,
  prefillCie10,
  initialMedications,
  onClose,
  onSaved,
}: Props) {
  return (
    <PatientWorkspaceOverlay
      open={open}
      title="Nueva receta"
      subtitle={patientName}
      onClose={onClose}
      wide
    >
      <PrescriptionForm
        patientId={patientId}
        patientInsurance={patientInsurance}
        clinicalRecordId={clinicalRecordId}
        diagnosisDefault={prefillDiagnosis ?? ""}
        cie10Default={prefillCie10 ?? ""}
        professionals={professionals}
        defaultProfessionalId={defaultProfessionalId}
        initialMedications={initialMedications}
        onSuccess={onSaved}
      />
    </PatientWorkspaceOverlay>
  );
}
