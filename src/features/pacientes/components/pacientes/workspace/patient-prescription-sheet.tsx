"use client";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import { PrescriptionForm } from "@/features/recetas/components/recetas/prescription-form";
import type { PrescriptionWizardPatient } from "@/features/recetas/hooks/use-prescription-wizard";

import type { PrescriptionMedication } from "@/types/prescription";

type Professional = {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | null;
};

type Props = {
  open: boolean;
  patientId: string;
  patient?: PrescriptionWizardPatient | null;
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
  patient,
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
        patient={patient}
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
