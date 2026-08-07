import type { HistoriaMedicalOrderSummary } from "@/features/historias/types/historia-clinical-summaries";
import type { MedicalOrderDocumentData } from "@/features/recetas/utils/print-medical-order-document";

import { buildProfessionalSignature, getProfessionalDisplayName } from "@/lib/utils/professional";

type PatientInfo = {
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date?: string | null;
  insurance_provider?: string | null;
  insurance_number?: string | null;
};

type ProfessionalInfo = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
  profiles?: { full_name?: string | null } | null;
  specialties?: { name?: string | null } | { name?: string | null }[] | null;
};

function professionalSpecialtyName(
  specialties: ProfessionalInfo["specialties"]
): string | null {
  if (!specialties) return null;
  if (Array.isArray(specialties)) return specialties[0]?.name ?? null;
  return specialties.name ?? null;
}

type ClinicInfo = {
  name: string;
  address?: string | null;
  phone?: string | null;
};

export function buildMedicalOrderDocumentData(
  order: HistoriaMedicalOrderSummary & { order_type?: string },
  patient: PatientInfo,
  clinic: ClinicInfo,
  professionals: ProfessionalInfo[]
): MedicalOrderDocumentData {
  const pro = professionals.find((p) => p.id === order.professional_id);
  const fullName = pro ? getProfessionalDisplayName(pro) : "Profesional";

  return {
    orderType: order.order_type,
    orderText: order.order_text,
    notes: order.notes,
    issuedAt: order.issued_at,
    status: order.status,
    patient: {
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      insurance_provider: patient.insurance_provider,
      insurance_number: patient.insurance_number,
    },
    professional: {
      full_name: fullName,
      license_number: pro?.license_number ?? null,
      specialty: professionalSpecialtyName(pro?.specialties) ?? null,
      signatureText: pro ? buildProfessionalSignature(pro) : null,
      signatureImageUrl: pro?.signature_image_url ?? null,
    },
    clinic,
  };
}
