"use client";

import { PatientWorkspaceOverlay } from "@/features/pacientes/components/pacientes/workspace/patient-workspace-overlay";
import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import { PrescriptionForm } from "@/features/recetas/components/recetas/prescription-form";
import type { PrescriptionWizardPatient } from "@/features/recetas/hooks/use-prescription-wizard";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";

import type { PrescriptionMedication } from "@/types/prescription";

type Professional = {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
};

type Props = {
  open: boolean;
  patientId: string;
  patient?: PrescriptionWizardPatient | null;
  patientInsurance?: string | null;
  patientAllergies?: string | null;
  patientName: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  clinicalRecordId?: string;
  prefillDiagnosis?: string;
  prefillCie10?: string;
  prefillIndications?: string;
  hceTreatments?: PatientEhrTreatmentRow[];
  patientAddress?: string | null;
  patientPhone?: string | null;
  clinic?: { name: string; address?: string | null; phone?: string | null };
  initialMedications?: PrescriptionMedication[];
  onClose: () => void;
  onSaved: () => void;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
};

export function PatientPrescriptionSheet({
  open,
  patientId,
  patient,
  patientInsurance,
  patientAllergies,
  patientName: _patientName,
  professionals,
  defaultProfessionalId,
  clinicalRecordId,
  prefillDiagnosis,
  prefillCie10,
  prefillIndications,
  hceTreatments = [],
  patientAddress,
  patientPhone,
  clinic,
  initialMedications,
  onClose,
  onSaved,
  coverageRuleOverrides = null,
}: Props) {
  return (
    <PatientWorkspaceOverlay open={open} title="Receta" onClose={onClose} wide>
      <PrescriptionForm
        layout="single"
        patientId={patientId}
        patient={patient}
        patientInsurance={patientInsurance}
        patientAllergies={patientAllergies}
        patientAddress={patientAddress}
        patientPhone={patientPhone}
        clinic={clinic}
        clinicalRecordId={clinicalRecordId}
        diagnosisDefault={prefillDiagnosis ?? ""}
        cie10Default={prefillCie10 ?? ""}
        notesDefault={prefillIndications ?? ""}
        hceTreatments={hceTreatments}
        professionals={professionals}
        defaultProfessionalId={defaultProfessionalId}
        initialMedications={initialMedications}
        onSuccess={onSaved}
        onCancel={onClose}
        coverageRuleOverrides={coverageRuleOverrides}
      />
    </PatientWorkspaceOverlay>
  );
}
