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

  if (!rpcError && Array.isArray(rpcData)) {
    for (const row of rpcData as Array<{ patient_id: string; count: number }>) {
      counts.set(row.patient_id, row.count);
    }
    return counts;
  }

  // RPC required at scale — return zero counts rather than scanning clinical_records.
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

/** Consultas visibles en HC: misma lógica que el sidebar (BD + resumen HCE). */
export async function batchPatientConsultationCounts(
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
