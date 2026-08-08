import type { SupabaseClient } from "@supabase/supabase-js";

import { PATIENT_ATTACHMENTS_LIMIT } from "@/core/supabase/pagination";

import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import { formatAgeLabel } from "@/features/pacientes/utils/patient-age";
import { countEhrConsultations } from "@/features/pacientes/utils/patient-ehr-consultation-count";
import {
  buildEhrPayloadFromHceRows,
  loadPatientHceSummaryRows,
  mergeEhrPayload,
} from "@/features/pacientes/utils/patient-ehr-from-hce";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/features/pacientes/utils/patient-ehr-model";
import { buildEhrPayloadFromRecords } from "@/features/pacientes/utils/patient-ehr-model";

import type { PatientEhrAppointment } from "@/lib/utils/build-clinical-timeline";
import type { HceExportRow } from "@/lib/utils/hce-export-parse";
import { filterRecordsForEhrSupplement } from "@/lib/utils/hce-export-parse";
import type { MedicalOrder } from "@/types/medical-order";

export const PATIENT_EHR_RECORD_LIMIT = 2000;
export const PATIENT_TIMELINE_APPOINTMENT_LIMIT = 80;
export const PATIENT_CHART_APPOINTMENT_LIMIT = 10;
export const PATIENT_RX_FETCH_LIMIT = 100;

export type PatientEhrWorkspacePrescription = PatientEhrPrescription & {
  issued_at: string | null;
  status: string;
};

export type PatientEhrWorkspaceData = {
  patientInfo: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrWorkspacePrescription[];
  prescriptionRecords: RawPrescriptionRow[];
  orders: (MedicalOrder & { order_type?: string })[];
  appointments: PatientEhrAppointment[];
  totalConsultations: number;
  usesHceExport: boolean;
};

export type PatientEhrPatientRow = {
  id: string;
  first_name: string;
  last_name: string;
  document_number: string;
  phone: string | null;
  email: string | null;
  birth_date: string | null;
  insurance_provider: string | null;
  insurance_number: string | null;
};

export type PatientEhrMappedRecord = {
  id: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  professional_name: string;
  professional_license_national?: string | null;
  professional_license_provincial?: string | null;
  professional_email?: string | null;
};

type RawPrescriptionRow = {
  id: string;
  created_at: string;
  medications: unknown;
  status: string;
  issued_at: string | null;
  professional_id: string;
  diagnosis_text: string | null;
  diagnosis_cie10: string | null;
  prescription_number: string | null;
  prescription_type: string;
  validity_days: number;
  patient_insurance: string | null;
  notes: string | null;
};

type RawAttachmentRow = {
  id: string;
  file_name: string;
  created_at: string;
  category: string | null;
};

type RawAppointmentRow = {
  id: string;
  start_at: string;
  status: string;
  professionals: unknown;
};

export function mapClinicalRecordsForEhr(
  records: Array<{
    id: string;
    created_at: string;
    chief_complaint: string | null;
    diagnosis: string | null;
    evolution: string | null;
    indications: string | null;
    professionals: unknown;
  }> | null
): PatientEhrMappedRecord[] {
  return (
    records?.map((r) => {
      const professional = r.professionals as {
        license_national?: string | null;
        license_provincial?: string | null;
        profiles?: { full_name?: string; email?: string } | { full_name?: string; email?: string }[] | null;
      } | null;
      const profile = Array.isArray(professional?.profiles)
        ? professional.profiles[0]
        : professional?.profiles;

      return {
        id: r.id,
        created_at: r.created_at,
        chief_complaint: r.chief_complaint,
        diagnosis: r.diagnosis,
        evolution: r.evolution,
        indications: r.indications,
        professional_name: profile?.full_name ?? "Profesional",
        professional_license_national: professional?.license_national ?? null,
        professional_license_provincial: professional?.license_provincial ?? null,
        professional_email: profile?.email ?? null,
      };
    }) ?? []
  );
}

export function mapTimelineAppointments(
  appointments: RawAppointmentRow[] | null
): PatientEhrAppointment[] {
  return (
    appointments?.map((a) => ({
      id: a.id,
      start_at: a.start_at,
      status: a.status,
      professional_name:
        (a.professionals as { profiles?: { full_name?: string } } | null)?.profiles?.full_name ??
        null,
    })) ?? []
  );
}

export function mapEhrPrescriptions(
  rxList: RawPrescriptionRow[] | null
): PatientEhrWorkspacePrescription[] {
  return (
    rxList?.map((rx) => {
      const meds = rx.medications as unknown;
      let label = "Receta";
      if (Array.isArray(meds) && meds.length > 0) {
        const first = meds[0] as { generic_name?: string; name?: string };
        const drugName = first.generic_name ?? first.name;
        label = drugName
          ? `Receta · ${drugName}${meds.length > 1 ? ` +${meds.length - 1}` : ""}`
          : "Receta";
      }
      return {
        id: rx.id,
        created_at: rx.created_at,
        issued_at: rx.issued_at,
        status: rx.status,
        label,
      };
    }) ?? []
  );
}

export function buildPatientEhrWorkspaceData(input: {
  patient: PatientEhrPatientRow;
  totalRecords: number | null;
  mappedRecords: PatientEhrMappedRecord[];
  attachments: RawAttachmentRow[] | null;
  rxList: RawPrescriptionRow[] | null;
  orders: (MedicalOrder & { order_type?: string })[] | null;
  timelineAppointments: PatientEhrAppointment[];
  hceRows: HceExportRow[] | null;
}): PatientEhrWorkspaceData {
  const { patient, totalRecords, mappedRecords, attachments, rxList, orders, timelineAppointments, hceRows } =
    input;

  const professionalFallback =
    mappedRecords.find((r) => r.professional_name !== "Profesional")?.professional_name ??
    "Importación HCE";

  let consultations: PatientEhrConsultation[];
  let diagnosisRows: PatientEhrDiagnosisRow[];
  let treatmentRows: PatientEhrTreatmentRow[];
  let usesHceExport = false;

  if (hceRows) {
    usesHceExport = true;
    const fromHce = buildEhrPayloadFromHceRows(hceRows, professionalFallback);
    const supplement = buildEhrPayloadFromRecords(filterRecordsForEhrSupplement(mappedRecords));
    ({ consultations, diagnosisRows, treatmentRows } = mergeEhrPayload(fromHce, supplement));
  } else {
    ({ consultations, diagnosisRows, treatmentRows } = buildEhrPayloadFromRecords(mappedRecords));
  }

  return {
    patientInfo: {
      id: patient.id,
      first_name: patient.first_name,
      last_name: patient.last_name,
      document_number: patient.document_number,
      birth_date: patient.birth_date,
      age_label: formatAgeLabel(patient.birth_date),
      insurance_provider: patient.insurance_provider,
      insurance_number: patient.insurance_number,
      phone: patient.phone,
      email: patient.email,
    },
    consultations,
    diagnosisRows,
    treatmentRows,
    attachments:
      attachments?.map((a) => ({
        id: a.id,
        file_name: a.file_name,
        created_at: a.created_at,
        category: a.category,
      })) ?? [],
    prescriptions: mapEhrPrescriptions(rxList),
    prescriptionRecords: rxList ?? [],
    orders: orders ?? [],
    appointments: timelineAppointments,
    totalConsultations: (() => {
      const sidebarCount = countEhrConsultations(consultations);
      return sidebarCount > 0 ? sidebarCount : (totalRecords ?? 0);
    })(),
    usesHceExport,
  };
}

export async function loadPatientEhrWorkspaceData(
  supabase: SupabaseClient,
  clinicId: string,
  patient: PatientEhrPatientRow
): Promise<PatientEhrWorkspaceData> {
  const patientId = patient.id;

  const [
    { count: totalRecords },
    { data: records },
    { data: attachments },
    { data: rxList },
    { data: orders },
    { data: appointments },
    hceRows,
  ] = await Promise.all([
    supabase
      .from("clinical_records")
      .select("id", { count: "exact", head: true })
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId),
    supabase
      .from("clinical_records")
      .select(
        "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(license_national, license_provincial, profiles(full_name, email))"
      )
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("created_at", { ascending: true })
      .limit(PATIENT_EHR_RECORD_LIMIT),
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, category")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(PATIENT_ATTACHMENTS_LIMIT),
    supabase
      .from("prescription_drafts")
      .select(
        "id, created_at, medications, status, diagnosis_text, diagnosis_cie10, issued_at, prescription_number, prescription_type, validity_days, patient_insurance, notes, professional_id"
      )
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
      .select("id, start_at, status, professionals(profiles(full_name))")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .in("status", ["attended", "no_show"])
      .order("start_at", { ascending: false })
      .limit(PATIENT_TIMELINE_APPOINTMENT_LIMIT),
    loadPatientHceSummaryRows(supabase, clinicId, patientId),
  ]);

  return buildPatientEhrWorkspaceData({
    patient,
    totalRecords,
    mappedRecords: mapClinicalRecordsForEhr(records),
    attachments,
    rxList,
    orders: (orders ?? []) as (MedicalOrder & { order_type?: string })[],
    timelineAppointments: mapTimelineAppointments(appointments),
    hceRows,
  });
}
