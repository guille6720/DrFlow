"use client";

import { PrescriptionWizard } from "@/features/recetas/components/recetas/prescription-wizard";
import type { PrescriptionWizardPatient } from "@/features/recetas/hooks/use-prescription-wizard";
import type { CoverageRuleOverridesMap } from "@/features/recetas/utils/coverage-rules-admin";

import type { PrescriptionMedication } from "@/types/prescription";

interface Professional {
  id: string;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  display_name?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
}

interface Props {
  patientId: string;
  patient?: PrescriptionWizardPatient | null;
  patientInsurance?: string | null;
  clinicalRecordId?: string;
  diagnosisDefault?: string;
  cie10Default?: string;
  professionals: Professional[];
  defaultProfessionalId?: string;
  initialMedications?: PrescriptionMedication[];
  onSuccess?: () => void;
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
}

/** Wizard de 3 pasos: cobertura → medicamentos → emitir */
export function PrescriptionForm({
  patientId,
  patient,
  patientInsurance,
  clinicalRecordId,
  diagnosisDefault = "",
  cie10Default = "",
  professionals,
  defaultProfessionalId,
  initialMedications,
  onSuccess,
  coverageRuleOverrides = null,
}: Props) {
  return (
    <PrescriptionWizard
      patientId={patientId}
      patient={patient}
      patientInsurance={patientInsurance}
      clinicalRecordId={clinicalRecordId}
      diagnosisDefault={diagnosisDefault}
      cie10Default={cie10Default}
      professionals={professionals}
      defaultProfessionalId={defaultProfessionalId}
      initialMedications={initialMedications}
      onSuccess={onSuccess}
      coverageRuleOverrides={coverageRuleOverrides}
    />
  );
}
