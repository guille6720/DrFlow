import type { SupabaseClient } from "@supabase/supabase-js";

/** Batch count clinical_records per patient — replaces N+1 head queries. */
export async function batchPatientRecordCounts(
  supabase: SupabaseClient,
  clinicId: string,
  patientIds: string[]
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (patientIds.length === 0) return counts;

  const { data } = await supabase
    .from("clinical_records")
    .select("patient_id")
    .eq("clinic_id", clinicId)
    .in("patient_id", patientIds);

  for (const row of data ?? []) {
    const pid = row.patient_id as string;
    counts.set(pid, (counts.get(pid) ?? 0) + 1);
  }

  for (const pid of patientIds) {
    if (!counts.has(pid)) counts.set(pid, 0);
  }

  return counts;
}
