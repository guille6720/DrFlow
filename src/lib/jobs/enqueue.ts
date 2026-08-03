import type { SupabaseClient } from "@supabase/supabase-js";
import { getClinicJobDefinition } from "@/lib/jobs/registry";
import type { EnqueueClinicJobInput } from "@/lib/jobs/types";

export async function enqueueClinicJob(
  supabase: SupabaseClient,
  input: EnqueueClinicJobInput
): Promise<{ id: string }> {
  const def = getClinicJobDefinition(input.jobType);

  const { data, error } = await supabase
    .from("clinic_jobs")
    .insert({
      clinic_id: input.clinicId,
      job_type: input.jobType,
      status: "pending",
      payload: input.payload,
      max_attempts: input.maxAttempts ?? def.defaultMaxAttempts,
      scheduled_at: input.scheduledAt ?? new Date().toISOString(),
      created_by: input.createdBy ?? null,
    })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "No se pudo encolar el trabajo");
  }

  return { id: data.id };
}
