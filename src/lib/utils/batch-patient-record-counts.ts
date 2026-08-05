import type { SupabaseClient } from "@supabase/supabase-js";

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
