import type { SupabaseClient } from "@supabase/supabase-js";

import { encodeDescCursor, PATIENT_ATTACHMENTS_LIMIT, PATIENT_EHR_RECORD_PAGE_SIZE } from "@/core/supabase/pagination";
import { MEDICAL_ORDER_LIST_COLUMNS, PRESCRIPTION_LIST_COLUMNS } from "@/core/supabase/select-columns";

import type { PatientEhrPatientInfo } from "@/features/historias/components/historias/patient-ehr-types";
import type {
  ClinicalDiagnosisEntry,
  ClinicalTreatmentEntry,
} from "@/features/historias/utils/clinical-structured-entries";
import {
  attachStructuredChildrenToRecords,
  loadClinicalRecordChildrenForPatient,
  loadPatientProblemList,
  type PatientProblemListItem,
} from "@/features/pacientes/server/load-clinical-structure";
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
import type { MedicalOrder } from "@/types/medical-order";

export const PATIENT_EHR_RECORD_LIMIT = PATIENT_EHR_RECORD_PAGE_SIZE;
/** First paint for resumen/SOAP/consulta — rest via “Ver anteriores”. */
export const PATIENT_EHR_INITIAL_LIMIT = 20;
/** Cap for full HC print (UI stays paginated; print fetches on demand). */
export const PATIENT_EHR_PRINT_MAX_RECORDS = 2000;
export const PATIENT_TIMELINE_APPOINTMENT_LIMIT = 80;
export const PATIENT_CHART_APPOINTMENT_LIMIT = 10;
export const PATIENT_RX_FETCH_LIMIT = 100;
/** Satellite caps for resumen/timeline first paint (preview + last consult). */
export const PATIENT_EHR_INITIAL_ATTACHMENT_LIMIT = 40;
export const PATIENT_EHR_INITIAL_RX_LIMIT = 20;
export const PATIENT_EHR_INITIAL_ORDER_LIMIT = 20;
export const PATIENT_EHR_INITIAL_APPOINTMENT_LIMIT = 20;

export const CLINICAL_RECORD_EHR_SELECT_FULL =
  "id, created_at, chief_complaint, diagnosis, evolution, indications, diagnosis_cie10, diagnoses_json, treatments_json, professional_id, professional_signature, professionals(license_national, license_provincial, profiles(full_name, email))";

export const CLINICAL_RECORD_EHR_SELECT_BASIC =
  "id, created_at, chief_complaint, diagnosis, evolution, indications, professional_id, professional_signature, professionals(license_national, license_provincial, profiles(full_name, email))";

export const CLINICAL_RECORD_EHR_SELECT_MINIMAL =
  "id, created_at, chief_complaint, diagnosis, evolution, indications, professional_id, professional_signature";

function isMissingStructuredColumnError(message: string | undefined): boolean {
  if (!message) return false;
  return /diagnoses_json|treatments_json|diagnosis_cie10/i.test(message);
}

function isProfessionalsEmbedError(message: string | undefined): boolean {
  if (!message) return false;
  return /professionals|profiles|foreign key|relationship|embed/i.test(message);
}

type ClinicalRecordEhrRow = {
  id: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
  diagnosis_cie10?: string | null;
  diagnoses_json?: unknown;
  treatments_json?: unknown;
  professional_id?: string | null;
  professional_signature?: string | null;
  professionals?: unknown;
};

/** Loads clinical_records for HC with progressive fallbacks (columns / joins). */
export async function fetchPatientClinicalRecordsForEhr(
  supabase: SupabaseClient,
  clinicId: string,
  patientId: string,
  options: { limit: number; withCount?: boolean }
): Promise<{
  data: ClinicalRecordEhrRow[] | null;
  count: number | null;
  error: { message: string } | null;
}> {
  const withCount = options.withCount === true;
  const run = async (columns: string, withLifecycleFilter: boolean) => {
    let query = supabase
      .from("clinical_records")
      .select(columns, withCount ? { count: "exact" } : undefined)
      .eq("clinic_id", clinicId)
      .eq("patient_id", patientId);

    if (withLifecycleFilter) {
      query = query.eq("lifecycle_status", "active");
    }

    const result = await query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(options.limit);

    return {
      data: (result.data as ClinicalRecordEhrRow[] | null) ?? null,
      count: result.count ?? null,
      error: result.error ? { message: result.error.message } : null,
    };
  };

  const runPreferringActive = async (columns: string) => {
    const withLifecycle = await run(columns, true);
    if (
      withLifecycle.error &&
      /lifecycle_status|column|schema cache|does not exist/i.test(withLifecycle.error.message)
    ) {
      return run(columns, false);
    }
    return withLifecycle;
  };

  const full = await runPreferringActive(CLINICAL_RECORD_EHR_SELECT_FULL);
  if (!full.error) return full;

  if (isMissingStructuredColumnError(full.error.message)) {
    const basic = await runPreferringActive(CLINICAL_RECORD_EHR_SELECT_BASIC);
    if (!basic.error) return basic;
    if (isProfessionalsEmbedError(basic.error.message)) {
      return runPreferringActive(CLINICAL_RECORD_EHR_SELECT_MINIMAL);
    }
    return basic;
  }

  if (isProfessionalsEmbedError(full.error.message)) {
    const minimal = await runPreferringActive(CLINICAL_RECORD_EHR_SELECT_MINIMAL);
    if (!minimal.error) return minimal;
  }

  // Last resort: plain columns without join (covers mixed schema issues).
  const minimal = await runPreferringActive(CLINICAL_RECORD_EHR_SELECT_MINIMAL);
  if (!minimal.error) return minimal;

  return full;
}

export type PatientEhrWorkspacePrescription = PatientEhrPrescription & {
  issued_at: string | null;
  status: string;
};

export type PatientEhrClinicalRecordsPagination = {
  total: number;
  hasMore: boolean;
  nextCursor: string | null;
};

export type PatientEhrWorkspaceData = {
  patientInfo: PatientEhrPatientInfo;
  consultations: PatientEhrConsultation[];
  diagnosisRows: PatientEhrDiagnosisRow[];
  treatmentRows: PatientEhrTreatmentRow[];
  problemList: PatientProblemListItem[];
  attachments: PatientEhrAttachment[];
  prescriptions: PatientEhrWorkspacePrescription[];
  prescriptionRecords: RawPrescriptionRow[];
  orders: (MedicalOrder & { order_type?: string })[];
  appointments: PatientEhrAppointment[];
  totalConsultations: number;
  usesHceExport: boolean;
  clinicalRecordsPagination: PatientEhrClinicalRecordsPagination;
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
  diagnosis_cie10?: string | null;
  diagnoses_json?: unknown;
  treatments_json?: unknown;
  diagnoses_rows?: ClinicalDiagnosisEntry[];
  treatments_rows?: ClinicalTreatmentEntry[];
  professional_id?: string | null;
  professional_signature?: string | null;
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
    diagnosis_cie10?: string | null;
    diagnoses_json?: unknown;
    treatments_json?: unknown;
    professional_id?: string | null;
    professional_signature?: string | null;
    professionals?: unknown;
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
        diagnosis_cie10: r.diagnosis_cie10 ?? null,
        diagnoses_json: r.diagnoses_json ?? [],
        treatments_json: r.treatments_json ?? [],
        professional_id: r.professional_id ?? null,
        professional_signature: r.professional_signature ?? null,
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
  clinicalRecordsPagination?: PatientEhrClinicalRecordsPagination;
  problemList?: PatientProblemListItem[];
}): PatientEhrWorkspaceData {
  const { patient, mappedRecords, attachments, rxList, orders, timelineAppointments, hceRows } =
    input;

  const professionalFallback =
    mappedRecords.find((r) => r.professional_name !== "Profesional")?.professional_name ??
    "Importación HCE";

  let consultations: PatientEhrConsultation[];
  let diagnosisRows: PatientEhrDiagnosisRow[];
  let treatmentRows: PatientEhrTreatmentRow[];
  let usesHceExport = false;

  // Always materialize every clinical_record so HC is never blank when BD has rows.
  const fromRecords = buildEhrPayloadFromRecords(mappedRecords, {
    includeHceStructural: true,
  });

  if (hceRows && hceRows.length > 0) {
    usesHceExport = true;
    const fromHce = buildEhrPayloadFromHceRows(hceRows, professionalFallback);
    ({ consultations, diagnosisRows, treatmentRows } = mergeEhrPayload(fromHce, fromRecords));
    // Safety net: if HCE had no evolutions and merge still empty, force BD rows.
    if (consultations.length === 0 && fromRecords.consultations.length > 0) {
      consultations = fromRecords.consultations;
      diagnosisRows =
        diagnosisRows.length > 0 ? diagnosisRows : fromRecords.diagnosisRows;
      treatmentRows =
        treatmentRows.length > 0 ? treatmentRows : fromRecords.treatmentRows;
    }
  } else {
    ({ consultations, diagnosisRows, treatmentRows } = fromRecords);
  }

  const totalConsultations = Math.max(
    countEhrConsultations(consultations),
    input.clinicalRecordsPagination?.total ?? 0,
    mappedRecords.length
  );

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
    problemList: input.problemList ?? [],
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
    totalConsultations,
    usesHceExport,
    clinicalRecordsPagination: input.clinicalRecordsPagination ?? {
      total: input.totalRecords ?? mappedRecords.length,
      hasMore: false,
      nextCursor: null,
    },
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
    recordsResult,
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
    fetchPatientClinicalRecordsForEhr(supabase, clinicId, patientId, {
      limit: PATIENT_EHR_INITIAL_LIMIT,
    }),
    supabase
      .from("patient_attachments")
      .select("id, file_name, created_at, category")
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(PATIENT_ATTACHMENTS_LIMIT),
    supabase
      .from("prescription_drafts")
      .select(PRESCRIPTION_LIST_COLUMNS)
      .eq("patient_id", patientId)
      .eq("clinic_id", clinicId)
      .order("created_at", { ascending: false })
      .limit(PATIENT_RX_FETCH_LIMIT),
    supabase
      .from("medical_orders")
      .select(MEDICAL_ORDER_LIST_COLUMNS)
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

  const records = recordsResult.data;

  const mappedBase = mapClinicalRecordsForEhr(records);
  const [{ diagnosesByRecord, treatmentsByRecord }, problemList] = await Promise.all([
    loadClinicalRecordChildrenForPatient(
      supabase,
      clinicId,
      patientId,
      mappedBase.map((r) => r.id)
    ),
    loadPatientProblemList(supabase, clinicId, patientId),
  ]);
  const mappedRecords = attachStructuredChildrenToRecords(
    mappedBase,
    diagnosesByRecord,
    treatmentsByRecord
  );
  const loadedRecords = mappedRecords.length;
  const totalRecordCount = totalRecords ?? loadedRecords;
  const oldestLoaded = records?.at(-1);

  return buildPatientEhrWorkspaceData({
    patient,
    totalRecords,
    mappedRecords,
    attachments,
    rxList,
    orders: (orders ?? []) as (MedicalOrder & { order_type?: string })[],
    timelineAppointments: mapTimelineAppointments(appointments),
    hceRows,
    problemList,
    clinicalRecordsPagination: {
      total: totalRecordCount,
      hasMore: loadedRecords < totalRecordCount,
      nextCursor:
        loadedRecords < totalRecordCount && oldestLoaded
          ? encodeDescCursor(oldestLoaded.created_at, oldestLoaded.id)
          : null,
    },
  });
}
