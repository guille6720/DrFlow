import type { SupabaseClient } from "@supabase/supabase-js";

import { mapClinicalRecordsForEhr } from "@/features/pacientes/server/load-patient-ehr-data";
import { countPatientConsultationsFromSources } from "@/features/pacientes/utils/patient-ehr-consultation-count";
import {
  HCE_SUMMARY_ATTACHMENT_NAME,
  loadPatientHceSummaryRowsFromPath,
} from "@/features/pacientes/utils/patient-ehr-from-hce";

import type { HceExportRow } from "@/lib/utils/hce-export-parse";

const CLINICAL_RECORD_COUNT_COLUMNS =
  "patient_id, id, created_at, chief_complaint, diagnosis, evolution, indications";

type ClinicalRecordRow = {
  patient_id: string;
  id: string;
  created_at: string;
  chief_complaint: string | null;
  diagnosis: string | null;
  evolution: string | null;
  indications: string | null;
};

type PatientCountRow = { patient_id: string; count: number };

/** RPC returns JSONB — PostgREST may deliver array or JSON string. */
function parsePatientCountRpcRows(data: unknown): PatientCountRow[] | null {
  if (data == null) return null;

  let parsed: unknown = data;
  if (typeof data === "string") {
    try {
      parsed = JSON.parse(data);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(parsed)) return null;
  return parsed as PatientCountRow[];
}

/** Batch count clinical_records per patient — SQL GROUP BY via RPC, fallback to row scan. */
export async function batchPatientRecordCounts(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  for (const pid of patientIds) {
    counts.set(pid, 0);
  }

  const { data: rpcData, error: rpcError } = await supabase.rpc(
    "count_clinical_records_by_patients",
    { p_clinic_id: clinicId, p_patient_ids: patientIds }
  );

  const rpcRows = !rpcError ? parsePatientCountRpcRows(rpcData) : null;
  if (rpcRows) {
    for (const row of rpcRows) {
      counts.set(row.patient_id, row.count);
    }
    return counts;
  }

  if (rpcError) {
    console.error("[batchPatientRecordCounts] RPC failed:", rpcError.message);
  }

  const { data: records, error: scanError } = await supabase
    .from("clinical_records")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds);

  if (scanError) {
    console.error("[batchPatientRecordCounts] fallback scan failed:", scanError.message);
    return counts;
  }

  for (const record of (records ?? []) as Array<{ patient_id: string }>) {
    counts.set(record.patient_id, (counts.get(record.patient_id) ?? 0) + 1);
  }

  return counts;
}

async function batchClinicalRecordsByPatient(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, ReturnType<typeof mapClinicalRecordsForEhr>>> {
  const byPatient = new Map<string, ReturnType<typeof mapClinicalRecordsForEhr>>();
  for (const patientId of patientIds) {
    byPatient.set(patientId, []);
  }
  if (patientIds.length === 0) return byPatient;

  const { data: records } = await supabase
    .from("clinical_records")
    .select(CLINICAL_RECORD_COUNT_COLUMNS)
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds)
    .order("created_at", { ascending: true });

  const rawByPatient = new Map<string, ClinicalRecordRow[]>();
  for (const patientId of patientIds) {
    rawByPatient.set(patientId, []);
  }

  for (const record of (records ?? []) as ClinicalRecordRow[]) {
    rawByPatient.get(record.patient_id)?.push(record);
  }

  for (const patientId of patientIds) {
    const rawRows = (rawByPatient.get(patientId) ?? []).map((record) => ({
      ...record,
      professionals: null,
    }));
    byPatient.set(patientId, mapClinicalRecordsForEhr(rawRows));
  }

  return byPatient;
}

async function batchHceRowsByPatient(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, HceExportRow[]>> {
  const rowsByPatient = new Map<string, HceExportRow[]>();
  if (patientIds.length === 0) return rowsByPatient;

  const { data: attachments } = await supabase
    .from("patient_attachments")
    .select("patient_id, file_path")
    .eq("clinic_id", clinicId)
    .eq("file_name", HCE_SUMMARY_ATTACHMENT_NAME)
    .in("patient_id", patientIds);

  const attachmentRows = attachments ?? [];
  if (attachmentRows.length === 0) return rowsByPatient;

  await Promise.all(
    attachmentRows.map(async (attachment) => {
      const rows = await loadPatientHceSummaryRowsFromPath(supabase, attachment.file_path);
      if (!rows?.length) return;
      rowsByPatient.set(attachment.patient_id, rows);
    })
  );

  return rowsByPatient;
}

/**
 * Listados (/pacientes, historias): conteo rápido vía RPC.
 * Evita bajar todos los clinical_records + CSV HCE en cada página.
 * La paridad exacta del sidebar HC se calcula al abrir el paciente.
 */
export async function batchPatientConsultationCounts(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  return batchPatientRecordCounts(supabase, clinicId, patientIds);
}

/**
 * Conteo alineado al sidebar HC (BD + HCE). Costoso: solo usar fuera de listados.
 */
export async function batchPatientConsultationCountsDetailed(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  const [recordsByPatient, hceRowsByPatient] = await Promise.all([
    batchClinicalRecordsByPatient(supabase, clinicId, patientIds),
    batchHceRowsByPatient(supabase, clinicId, patientIds),
  ]);

  for (const patientId of patientIds) {
    counts.set(
      patientId,
      countPatientConsultationsFromSources({
        mappedRecords: recordsByPatient.get(patientId) ?? [],
        hceRows: hceRowsByPatient.get(patientId) ?? null,
      })
    );
  }

  return counts;
}
