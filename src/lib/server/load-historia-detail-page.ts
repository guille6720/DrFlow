import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalDocumentItem } from "@/components/historias/clinical-documents-panel";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";

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
    professionals: { profiles: { full_name: string } | null };
  };
  patient: HistoriaDetailPatient;
  portalSlug: string | null;
  doctorInfo: Awaited<ReturnType<typeof getDoctorShareInfoForClinic>>;
  audit: Array<{
    id: string;
    action: string;
    changed_at: string;
    profiles: { full_name: string } | null;
  }>;
  prescriptions: unknown[];
  professionalList: HistoriaDetailProfessional[];
  medicalOrders: unknown[];
  patientShare: {
    sharedAt: string;
    sharedByName: string | null;
    channel: string;
  } | null;
  clinicalDocuments: ClinicalDocumentItem[];
  professional: { profiles: { full_name: string } | null };
};

export async function loadHistoriaDetailPageData(
  supabase: SupabaseClient,
  id: string,
  clinicId: string
): Promise<HistoriaDetailPageData | null> {
  const { data: record } = await supabase
    .from("clinical_records")
    .select(
      "*, patients(id, first_name, last_name, document_number, birth_date, insurance_provider, insurance_number, phone, email, allergies, regular_medication, emergency_contact_name, emergency_contact_phone), professionals(profiles(full_name))"
    )
    .eq("id", id)
    .eq("clinic_id", clinicId)
    .single();

  if (!record) return null;

  const patient = record.patients as unknown as HistoriaDetailPatient;
  const portalSlug = await getPortalSlugForClinic(clinicId);
  const doctorInfo = portalSlug ? await getDoctorShareInfoForClinic(clinicId) : null;

  const [
    { data: audit },
    { data: prescriptions },
    { data: professionals },
    { data: medicalOrders },
    { data: appShare },
    { data: clinicalDocuments },
  ] = await Promise.all([
    supabase
      .from("clinical_record_audit")
      .select("*, profiles:changed_by(full_name)")
      .eq("clinical_record_id", id)
      .order("changed_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("*")
      .eq("clinical_record_id", id)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabase
      .from("professionals")
      .select("id, display_name, license_number, profiles(full_name), specialties(name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true),
    supabase
      .from("medical_orders")
      .select("*")
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

  const professional = record.professionals as unknown as {
    profiles: { full_name: string } | null;
  };
  const professionalList = (professionals ?? []) as unknown as HistoriaDetailProfessional[];

  return {
    record: record as HistoriaDetailPageData["record"],
    patient,
    portalSlug,
    doctorInfo,
    audit: (audit ?? []) as HistoriaDetailPageData["audit"],
    prescriptions: prescriptions ?? [],
    professionalList,
    medicalOrders: medicalOrders ?? [],
    patientShare,
    clinicalDocuments: (clinicalDocuments ?? []) as ClinicalDocumentItem[],
    professional,
  };
}
