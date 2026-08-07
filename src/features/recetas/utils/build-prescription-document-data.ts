import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import type { PrescriptionDocumentData } from "@/features/recetas/utils/print-prescription-document";

import { getProfessionalDisplayName } from "@/lib/utils/professional";
import type { PrescriptionMedication } from "@/types/prescription";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

type ProfessionalInfo = {
  id?: string;
  display_name?: string | null;
  license_number?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

function professionalSpecialtyName(
  specialties: ProfessionalInfo["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

function medications(value: unknown): PrescriptionMedication[] {
  return Array.isArray(value) ? (value as PrescriptionMedication[]) : [];
}

export function buildPrescriptionDocumentData(
  prescription: HistoriaPrescriptionSummary,
  patient: PatientInfo,
  clinic: ClinicInfo,
  professionals: ProfessionalInfo[]
): PrescriptionDocumentData {
  const pro =
    professionals.find((p) => p.id && p.id === prescription.professional_id) ??
    professionals[0];

  return {
    prescriptionNumber: prescription.prescription_number,
    prescriptionType: prescription.prescription_type ?? "ambulatoria",
    validityDays: prescription.validity_days ?? 30,
    status: prescription.status,
    issuedAt: prescription.issued_at ?? prescription.created_at,
    diagnosisCie10: prescription.diagnosis_cie10 ?? null,
    diagnosisText: prescription.diagnosis_text,
    medications: medications(prescription.medications),
    notes: prescription.notes ?? null,
    patientInsurance: prescription.patient_insurance ?? null,
    patient: {
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      insurance_provider: patient.insurance_provider,
      insurance_number: patient.insurance_number,
    },
    professional: {
      full_name: pro ? getProfessionalDisplayName(pro) : "Profesional",
      license_number: pro?.license_number ?? null,
      specialty: professionalSpecialtyName(pro?.specialties),
    },
    clinic,
  };
}
