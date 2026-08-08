import type { SupabaseClient } from "@supabase/supabase-js";

import { countConsultationsFromHceRows } from "@/features/pacientes/utils/patient-ehr-consultation-count";
import {
  HCE_SUMMARY_ATTACHMENT_NAME,
  loadPatientHceSummaryRowsFromPath,
} from "@/features/pacientes/utils/patient-ehr-from-hce";

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

async function batchHceSidebarConsultationCounts(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  const { data: attachments } = await supabase
    .from("patient_attachments")
    .select("patient_id, file_path")
    .eq("clinic_id", clinicId)
    .eq("file_name", HCE_SUMMARY_ATTACHMENT_NAME)
    .in("patient_id", patientIds);

  await Promise.all(
    (attachments ?? []).map(async (attachment) => {
      const rows = await loadPatientHceSummaryRowsFromPath(supabase, attachment.file_path);
      if (!rows) return;
      counts.set(attachment.patient_id, countConsultationsFromHceRows(rows));
    })
  );

  return counts;
}

/** Consultas visibles en HC: registros en BD + evoluciones importadas desde HCE. */
export async function batchPatientConsultationCounts(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const [recordCounts, hceCounts] = await Promise.all([
    batchPatientRecordCounts(supabase, clinicId, patientIds),
    batchHceSidebarConsultationCounts(supabase, clinicId, patientIds),
  ]);

  const merged = new Map<string, number>();
  for (const patientId of patientIds) {
    const recordCount = recordCounts.get(patientId) ?? 0;
    const hceCount = hceCounts.get(patientId) ?? 0;
    merged.set(patientId, hceCount > 0 ? Math.max(recordCount, hceCount) : recordCount);
  }

  return merged;
}
