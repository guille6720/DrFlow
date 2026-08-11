import type { SupabaseClient } from "@supabase/supabase-js";

import { voidRecordSensitiveAccess } from "@/core/security/sensitive-access-audit";

import type { ClinicalDocumentItem } from "@/features/historias/components/historias/clinical-documents-panel";
import type {
  HistoriaMedicalOrderSummary,
  HistoriaPrescriptionSummary,
} from "@/features/historias/types/historia-clinical-summaries";

import { getCachedClinicProfessionalsFull } from "@/lib/server/cached-clinic-queries";
import { getPortalContextForClinic } from "@/lib/utils/portal-doctor-info";

export type HistoriaDetailPatient = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  birth_date: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
  phone: string | null;
  email: string | null;
  allergies: string | null;
  regular_medication: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
};

export type HistoriaDetailProfessional = {
  id: string;
  display_name?: string | null;
  license_number?: string | null;
  license_national?: string | null;
  license_provincial?: string | null;
  signature_text?: string | null;
  signature_image_url?: string | null;
  profiles?: { full_name: string } | null;
  specialties?: { name: string } | { name: string }[] | null;
};

export type HistoriaDetailPageData = {
  record: Record<string, unknown> & {
    id: string;
    created_at: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    professional_signature: string | null;
    appointment_id: string | null;
    professional_id: string;
    patients: HistoriaDetailPatient;
    professionals: {
      license_national?: string | null;
      license_provincial?: string | null;
      license_number?: string | null;
      profiles: { full_name: string; email?: string | null } | null;
    };
  };
  patient: HistoriaDetailPatient;
  portalSlug: string | null;
  doctorInfo: Awaited<ReturnType<typeof getPortalContextForClinic>>["doctorInfo"];
  audit: Array<{
    id: string;
    action: string;
    changed_at: string;
    profiles: { full_name: string } | null;
  }>;
  prescriptions: HistoriaPrescriptionSummary[];
  professionalList: HistoriaDetailProfessional[];
  medicalOrders: HistoriaMedicalOrderSummary[];
  patientShare: {
    sharedAt: string;
    sharedByName: string | null;
    channel: string;
  } | null;
  clinicalDocuments: ClinicalDocumentItem[];
  professional: {
    license_national?: string | null;
    license_provincial?: string | null;
    license_number?: string | null;
    profiles: { full_name: string; email?: string | null } | null;
  };
};

export async function loadHistoriaDetailPageData(
  supabase: SupabaseClient,
  id: string,
  clinicId: string
): Promise<HistoriaDetailPageData | null> {
  const { data: record } = await supabase
    .from("clinical_records")
    .select(
      "*, patients(id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, allergies, regular_medication, emergency_contact_name, emergency_contact_phone), professionals(license_national, license_provincial, license_number, profiles(full_name, email))"
    )
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!record) return null;

  const patient = record.patients as unknown as HistoriaDetailPatient;
  const { portalSlug, doctorInfo } = await getPortalContextForClinic(clinicId);

  const [
    { data: audit },
    { data: prescriptions },
    professionals,
    { data: medicalOrders },
    { data: appShare },
    { data: clinicalDocuments },
  ] = await Promise.all([
    supabase
      .from("clinical_record_audit")
      .select("id, action, changed_at, profiles:changed_by(full_name)")
      .eq("clinical_record_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("id, created_at, medications, status, diagnosis_text, issued_at, prescription_number")
      .eq("clinical_record_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    getCachedClinicProfessionalsFull(clinicId),
    supabase
      .from("medical_orders")
      .select(
        "id, order_text, order_type, notes, status, issued_at, created_at, updated_at, version, professional_id, patient_id, clinical_record_id"
      )
      .eq("clinical_record_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("shared_at, channel, profiles(full_name)")
          .eq("patient_id", patient.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("patient_attachments")
      .select("id, file_name, file_size, category, created_at, profiles:uploaded_by(full_name)")
      .eq("patient_id", patient.id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
  ]);

  const shareProfile = appShare?.profiles as { full_name?: string } | null;
  const patientShare = appShare
    ? {
        sharedAt: appShare.shared_at,
        sharedByName: shareProfile?.full_name ?? null,
        channel: appShare.channel,
      }
    : null;

  const professional = record.professionals as unknown as HistoriaDetailPageData["professional"];
  const professionalList = (professionals ?? []) as unknown as HistoriaDetailProfessional[];

  voidRecordSensitiveAccess({
    clinicId,
    patientId: patient.id,
    kind: "clinical_record_detail",
    entityType: "clinical_record",
    entityId: id,
  });

  return {
    record: record as HistoriaDetailPageData["record"],
    patient,
    portalSlug,
    doctorInfo,
    audit: (audit ?? []) as unknown as HistoriaDetailPageData["audit"],
    prescriptions: (prescriptions ?? []) as HistoriaPrescriptionSummary[],
    professionalList,
    medicalOrders: (medicalOrders ?? []) as HistoriaMedicalOrderSummary[],
    patientShare,
    clinicalDocuments: (clinicalDocuments ?? []) as ClinicalDocumentItem[],
    professional,
  };
}
