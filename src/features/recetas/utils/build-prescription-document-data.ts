import type { HistoriaPrescriptionSummary } from "@/features/historias/types/historia-clinical-summaries";
import {
  type CoverageRuleOverridesMap,
  resolveCoverageRuleOverride,
} from "@/features/recetas/utils/coverage-rules-admin";
import {
  resolvePrescriptionDocumentCoverage,
  resolvePrescriptionDocumentQr,
} from "@/features/recetas/utils/prescription-document-coverage";
import type { PrescriptionDocumentData } from "@/features/recetas/utils/print-prescription-document";

import { getProfessionalDisplayName } from "@/lib/utils/professional";
import { resolveProfessionalDocumentSignature } from "@/lib/utils/professional-signature-document";
import type { PrescriptionMedication } from "@/types/prescription";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  sex?: string | null;
  cuil?: string | null;
  alt_identifier_type?: string | null;
  alt_identifier_value?: string | null;
  address?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

type ProfessionalInfo = {
  id?: string;
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  licensing_jurisdiction?: string | null;
  refeps_identifier?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
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
  professionals: ProfessionalInfo[],
  options?: { coverageRuleOverrides?: CoverageRuleOverridesMap | null }
): PrescriptionDocumentData {
  const pro =
    professionals.find((p) => p.id && p.id === prescription.professional_id) ??
    professionals[0];

  const coverage = resolvePrescriptionDocumentCoverage({
    coverage_kind: prescription.coverage_kind,
    patient_insurance: prescription.patient_insurance,
    insurance_number: prescription.insurance_number,
    insurance_plan: prescription.insurance_plan,
    patientInsuranceFallback: patient.insurance_provider,
    patientNumberFallback: patient.insurance_number,
  });

  const issuedAt = prescription.issued_at ?? prescription.created_at;
  const ruleOverride = resolveCoverageRuleOverride(
    coverage.kind,
    options?.coverageRuleOverrides
  );
  const qr = resolvePrescriptionDocumentQr({
    refepsStatus: prescription.refeps_status,
    refepsId: prescription.refeps_id,
    digitalSignatureHash: prescription.digital_signature_hash,
    prescriptionNumber: prescription.prescription_number,
    prescriptionId: prescription.id,
    patientDocumentNumber: patient.document_number,
    issuedAt,
    coverageKind: coverage.kind,
    clinicRuleOverride: ruleOverride,
    nationalRxStatus: prescription.national_rx_status,
    cuirStatus: prescription.cuir_status,
    cuirFormatted: prescription.cuir_formatted,
  });

  return {
    prescriptionId: prescription.id,
    prescriptionNumber: prescription.prescription_number,
    prescriptionType: prescription.prescription_type ?? "ambulatoria",
    validityDays: prescription.validity_days ?? 30,
    status: prescription.status,
    issuedAt,
    diagnosisCie10: prescription.diagnosis_cie10 ?? null,
    diagnosisText: prescription.diagnosis_text,
    medications: medications(prescription.medications),
    notes: prescription.notes ?? null,
    patientInsurance: prescription.patient_insurance ?? null,
    coverage,
    showQr: qr.showQr,
    qrPayload: qr.qrPayload,
    qrTitle: qr.qrTitle,
    qrHint: qr.qrHint,
    refepsStatus: prescription.refeps_status ?? null,
    refepsId: prescription.refeps_id ?? null,
    nationalRxStatus: prescription.national_rx_status ?? null,
    cuirStatus: prescription.cuir_status ?? null,
    cuirFormatted: prescription.cuir_formatted ?? null,
    patient: {
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      sex: patient.sex,
      cuil: patient.cuil,
      alt_identifier_type: patient.alt_identifier_type,
      alt_identifier_value: patient.alt_identifier_value,
      address: patient.address,
      insurance_provider: patient.insurance_provider,
      insurance_number: patient.insurance_number,
    },
    professional: {
      full_name: pro ? getProfessionalDisplayName(pro) : "Profesional",
      license_number: pro?.license_number ?? pro?.license_national ?? null,
      specialty: professionalSpecialtyName(pro?.specialties),
      profession: "Médico/a",
      jurisdiction: pro?.licensing_jurisdiction ?? null,
      refeps_identifier: pro?.refeps_identifier ?? null,
      ...resolveProfessionalDocumentSignature(pro),
    },
    clinic,
  };
}
