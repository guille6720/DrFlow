"use client";

import type { PatientEhrTreatmentRow } from "@/features/pacientes/utils/patient-ehr-model";
import { PrescriptionSinglePageForm } from "@/features/recetas/components/recetas/prescription-single-page-form";
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
  patientAllergies?: string | null;
  patientAddress?: string | null;
  patientPhone?: string | null;
  clinic?: { name: string; address?: string | null; phone?: string | null };
  clinicalRecordId?: string;
  diagnosisDefault?: string;
  cie10Default?: string;
  notesDefault?: string;
  hceTreatments?: PatientEhrTreatmentRow[];
  professionals: Professional[];
  defaultProfessionalId?: string;
  initialMedications?: PrescriptionMedication[];
  onSuccess?: () => void;
  onCancel?: () => void;
  layout?: "single" | "wizard";
  coverageRuleOverrides?: CoverageRuleOverridesMap | null;
}

/** Formulario de receta: una pantalla (HC) o wizard de 3 pasos (tab recetas). */
export function PrescriptionForm({
  patientId,
  patient,
  patientInsurance,
  patientAllergies,
  patientAddress,
  patientPhone,
  clinic,
  clinicalRecordId,
  diagnosisDefault = "",
  cie10Default = "",
  notesDefault = "",
  hceTreatments = [],
  professionals,
  defaultProfessionalId,
  initialMedications,
  onSuccess,
  onCancel,
  layout = "single",
  coverageRuleOverrides = null,
}: Props) {
  const shared = {
    patientId,
    patient,
    patientInsurance,
    patientAllergies,
    patientAddress,
    patientPhone,
    clinic,
    clinicalRecordId,
    diagnosisDefault,
    cie10Default,
    notesDefault,
    hceTreatments,
    professionals,
    defaultProfessionalId,
    initialMedications,
    onSuccess,
    coverageRuleOverrides,
  };

  if (layout === "wizard") {
    return <PrescriptionWizard {...shared} />;
  }

  return <PrescriptionSinglePageForm {...shared} onCancel={onCancel} />;
}
