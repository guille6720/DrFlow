import type { SupabaseClient } from "@supabase/supabase-js";
import { formatAgeLabel } from "@/lib/utils/patient-age";
import { buildEhrPayloadFromRecords } from "@/lib/utils/patient-ehr-model";
import { filterRecordsForEhrSupplement } from "@/lib/utils/hce-export-parse";
import {
  buildEhrPayloadFromHceRows,
  loadPatientHceSummaryRows,
  mergeEhrPayload,
} from "@/lib/utils/patient-ehr-from-hce";
import type { PatientEhrPatientInfo } from "@/components/historias/patient-ehr-types";
import type {
  PatientEhrAttachment,
  PatientEhrConsultation,
  PatientEhrDiagnosisRow,
  PatientEhrPrescription,
  PatientEhrTreatmentRow,
} from "@/lib/utils/patient-ehr-model";
import type { MedicalOrder } from "@/types/medical-order";

const RECORD_LIMIT = 2000;

export type PatientEhrWorkspaceData = {
  patientInfo: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrPrescription[];
  orders: (MedicalOrder & { order_type?: string })[];
  totalConsultations: number;
  usesHceExport: boolean;
};

type PatientRow = {
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

export async function loadPatientEhrWorkspaceData(
  supabase: SupabaseClient,
  clinicId: string,
  patient: PatientRow
): Promise<PatientEhrWorkspaceData> {
  const patientId = patient.id;

  const { count: totalRecords } = await supabase
    .from("clinical_records")
    .select("id", { count: "exact", head: true })
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId);

  const { data: records } = await supabase
    .from("clinical_records")
    .select(
      "id, created_at, chief_complaint, diagnosis, evolution, indications, professionals(profiles(full_name))"
    )
    .eq("clinic_id", clinicId)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: true })
    .limit(RECORD_LIMIT);

  const [{ data: attachments }, { data: rxList }, { data: orders }] = await Promise.all([
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, category")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false }),
    supabase
      .from("prescription_drafts")
      .select("id, created_at, medications, status, diagnosis_text, issued_at, prescription_number")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("medical_orders")
      .select("*")
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId)
      .order("issued_at", { ascending: false })
      .limit(50),
  ]);

  const mappedRecords =
    records?.map((r) => ({
      id: r.id,
      created_at: r.created_at,
      chief_complaint: r.chief_complaint,
      diagnosis: r.diagnosis,
      evolution: r.evolution,
      indications: r.indications,
      professional_name:
        (r.professionals as { profiles?: { full_name?: string } } | null)?.profiles?.full_name ??
        "Profesional",
    })) ?? [];

  const hceRows = await loadPatientHceSummaryRows(supabase, clinicId, patientId);
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

  const prescriptions: PatientEhrPrescription[] =
    rxList?.map((rx) => {
      const meds = rx.medications as unknown;
      let label = "Receta";
      if (Array.isArray(meds) && meds.length > 0) {
        const first = meds[0] as { name?: string };
        label = first.name
          ? `Receta · ${first.name}${meds.length > 1 ? ` +${meds.length - 1}` : ""}`
          : "Receta";
      }
      return {
        id: rx.id,
        created_at: rx.created_at,
        label,
      };
    }) ?? [];

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
    prescriptions,
    orders: (orders ?? []) as (MedicalOrder & { order_type?: string })[],
    totalConsultations: usesHceExport
      ? diagnosisRows.length + treatmentRows.length + consultations.length
      : (totalRecords ?? consultations.length),
    usesHceExport,
  };
}
