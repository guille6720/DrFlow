import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicalDocumentItem } from "@/components/historias/clinical-documents-panel";
import type { PatientChartAppointment, PatientChartPatient } from "@/components/pacientes/patient-chart-types";
import type { DoctorShareInfo } from "@/lib/utils/doctor-share-info";
import { buildPatientChartPayload } from "@/lib/utils/patient-chart-model";
import type { PatientChartPayload } from "@/lib/utils/patient-chart-types";
import type { PrescriptionMedication } from "@/types/prescription";
import { getDoctorShareInfoForClinic, getPortalSlugForClinic } from "@/lib/utils/portal-doctor-info";
import {
  buildPatientEhrWorkspaceData,
  mapClinicalRecordsForEhr,
  mapTimelineAppointments,
  PATIENT_CHART_APPOINTMENT_LIMIT,
  PATIENT_EHR_RECORD_LIMIT,
  PATIENT_RX_FETCH_LIMIT,
  PATIENT_TIMELINE_APPOINTMENT_LIMIT,
  type PatientEhrPatientRow,
  type PatientEhrWorkspaceData,
} from "@/lib/server/load-patient-ehr-data";
import { loadPatientHceSummaryRows } from "@/lib/utils/patient-ehr-from-hce";
import type { MedicalOrder } from "@/types/medical-order";
import {
  loadPatientClinicalProfile,
  mergePatientClinicalFields,
  type PatientClinicalProfileFields,
} from "@/lib/server/patient-clinical-profile";
import type { ClinicalTemplateRow } from "@/components/pacientes/patient-workspace-types";

export type PatientWorkspaceProfessional = {
  id: string;
  display_name: string;
  license_number: string | null;
  profiles: { full_name: string } | null;
};

export type PatientWorkspacePagePayload = {
  patient: PatientRow;
  ehr: PatientEhrWorkspaceData;
  chart: PatientChartPayload;
  appointments: PatientChartAppointment[];
  clinicalDocuments: ClinicalDocumentItem[];
  professionals: PatientWorkspaceProfessional[];
  lastMedications: PrescriptionMedication[] | null;
  templates: ClinicalTemplateRow[];
  patientShare: {
    sharedAt: string;
    sharedByName: string | null;
    channel: string;
  } | null;
  portalSlug: string | null;
  doctorInfo: DoctorShareInfo | null;
};

type PatientRow = PatientChartPatient &
  PatientClinicalProfileFields & {
    is_active?: boolean;
  };

function mapClinicalDocuments(
  rows: Array<{
    id: string;
    file_name: string;
    file_size: number | null;
    category: string | null;
    created_at: string;
    profiles: unknown;
  }> | null
): ClinicalDocumentItem[] {
  return (
    rows?.map((d) => ({
      id: d.id,
      file_name: d.file_name,
      file_size: d.file_size,
      category: d.category,
      created_at: d.created_at,
      profiles: d.profiles as ClinicalDocumentItem["profiles"],
    })) ?? []
  );
}

function mapChartAppointments(rows: unknown): PatientChartAppointment[] {
  return (rows ?? []) as PatientChartAppointment[];
}

function mapProfessionals(
  rows: Array<{
    id: string;
    display_name: string;
    license_number: string | null;
    profiles: { full_name: string } | { full_name: string }[] | null;
  }> | null
): PatientWorkspaceProfessional[] {
  return (
    rows?.map((p) => ({
      id: p.id,
      display_name: p.display_name,
      license_number: p.license_number,
      profiles: Array.isArray(p.profiles)
        ? (p.profiles[0] as { full_name: string } | undefined) ?? null
        : (p.profiles as { full_name: string } | null),
    })) ?? []
  );
}

/** Single parallel fetch for patient workspace — avoids duplicate Supabase round-trips. */
export async function loadPatientWorkspacePageData(
  supabase: SupabaseClient,
  clinicId: string,
  patient: PatientRow
): Promise<PatientWorkspacePagePayload> {
  const patientId = patient.id;
  const portalSlug = await getPortalSlugForClinic(clinicId);

  const [
    { count: totalRecords },
    { data: records },
    { data: attachments },
    { data: rxList },
    { data: orders },
    { data: chartAppointments },
    { data: timelineAppointments },
    { data: professionals },
    appShareResult,
    hceRows,
    clinicalProfileResult,
    { data: templates },
  ] = await Promise.all([
    supabase
      .from("clinical_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("clinical_records")
      .select(
        "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(profiles(full_name))"
      )
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true })
      .limit(PATIENT_EHR_RECORD_LIMIT),
    supabase
      .from("patient_attachments")
      .select("id, file_name, file_size, category, created_at, profiles:uploaded_by(full_name)")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("id, created_at, medications, status, diagnosis_text, issued_at, prescription_number")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(PATIENT_RX_FETCH_LIMIT),
    supabase
      .from("medical_orders")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(50),
    supabase
      .from("appointments")
      .select(
        "id, start_at, status, cancellation_reason, cancelled_by_type, professionals(profiles(full_name))"
      )
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("start_at", { ascending: false })
      .limit(PATIENT_CHART_APPOINTMENT_LIMIT),
    supabase
      .from("appointments")
      .select("id, start_at, status, professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .in("status", ["attended", "no_show"])
      .order("start_at", { ascending: false })
      .limit(PATIENT_TIMELINE_APPOINTMENT_LIMIT),
    supabase
      .from("professionals")
      .select("id, display_name, license_number, profiles(full_name)")
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("display_name"),
    portalSlug
      ? supabase
          .from("patient_app_share_log")
          .select("shared_at, channel, profiles(full_name)")
          .eq("patient_id", patientId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    loadPatientHceSummaryRows(supabase, clinicId, patientId),
    supabase
      .from("patient_clinical_profiles")
      .select("medical_history, allergies, regular_medication, notes")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .maybeSingle(),
    supabase
      .from("clinical_templates")
      .select(
        "id, name, chief_complaint_template, diagnosis_template, evolution_template, indications_template"
      )
      .eq("clinic_id", clinicId)
      .eq("is_active", true)
      .order("name"),
  ]);

  const doctorInfo = portalSlug ? await getDoctorShareInfoForClinic(clinicId) : null;
  const patientWithClinical = mergePatientClinicalFields(patient, clinicalProfileResult.data);

  const mappedRecords = mapClinicalRecordsForEhr(records);
  const clinicalDocuments = mapClinicalDocuments(attachments);
  const issuedPrescriptions = (rxList ?? []).filter((rx) => rx.status === "issued");
  const lastRx = issuedPrescriptions[0];
  const lastMedications = (lastRx?.medications as PrescriptionMedication[] | null) ?? null;

  const ehr = buildPatientEhrWorkspaceData({
    patient,
    totalRecords,
    mappedRecords,
    attachments,
    rxList,
    orders: (orders ?? []) as (MedicalOrder & { order_type?: string })[],
    timelineAppointments: mapTimelineAppointments(timelineAppointments),
    hceRows,
  });

  const chart = buildPatientChartPayload({
    patient: {
      birth_date: patientWithClinical.birth_date,
      insurance_provider: patientWithClinical.insurance_provider,
      medical_history: patientWithClinical.medical_history,
      allergies: patientWithClinical.allergies,
      regular_medication: patientWithClinical.regular_medication,
      notes: patientWithClinical.notes,
    },
    records: mappedRecords,
    prescriptions: issuedPrescriptions.map((p) => ({
      id: p.id,
      created_at: p.issued_at ?? p.created_at,
      medications: p.medications,
    })),
    attachments: clinicalDocuments.map((d) => {
      const profile = Array.isArray(d.profiles) ? d.profiles[0] : d.profiles;
      return {
        id: d.id,
        file_name: d.file_name,
        category: d.category,
        created_at: d.created_at,
        uploaded_by: profile?.full_name ?? null,
      };
    }),
  });

  const appShare = appShareResult.data;
  const shareProfile = appShare?.profiles as { full_name?: string } | null;

  return {
    patient: patientWithClinical,
    ehr,
    chart,
    appointments: mapChartAppointments(chartAppointments),
    clinicalDocuments,
    professionals: mapProfessionals(professionals),
    lastMedications,
    templates: (templates ?? []) as ClinicalTemplateRow[],
    patientShare: appShare
      ? {
          sharedAt: appShare.shared_at,
          sharedByName: shareProfile?.full_name ?? null,
          channel: appShare.channel,
        }
      : null,
    portalSlug,
    doctorInfo,
  };
}
