import { createAdminClient, hasAdminClient } from "@/lib/supabase/admin";
import { runClinicJobHandler } from "@/lib/jobs/handlers";
import type { ClinicJobRow } from "@/lib/jobs/types";

export type ProcessJobsResult = {
  processed: number;
  completed: number;
  failed: number;
  jobIds: string[];
};

function mapJobRow(row: Record<string, unknown>): ClinicJobRow {
  return row as unknown as ClinicJobRow;
}

export async function processPendingClinicJobs(options?: {
  limit?: number;
  clinicId?: string;
}): Promise<ProcessJobsResult> {
  if (!hasAdminClient()) {
    console.warn("[clinic_jobs] SUPABASE_SERVICE_ROLE_KEY missing — skip worker");
    return { processed: 0, completed: 0, failed: 0, jobIds: [] };
  }

  const supabase = createAdminClient();
  const limit = options?.limit ?? 10;

  const { data: claimed, error: claimError } = await supabase.rpc("claim_clinic_jobs", {
    p_limit: limit,
  });

  if (claimError) {
    throw new Error(claimError.message);
  }

  const jobs = (claimed ?? []) as Record<string, unknown>[];
  const filtered = options?.clinicId
    ? jobs.filter((j) => j.clinic_id === options.clinicId)
    : jobs;

  let completed = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const raw of filtered) {
    const job = mapJobRow(raw);
    jobIds.push(job.id);

    try {
      const result = await runClinicJobHandler(supabase, job);
      await supabase.rpc("complete_clinic_job", {
        p_job_id: job.id,
        p_status: "completed",
        p_result: result,
        p_error_message: null,
      });
      completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      const retry = job.attempts < job.max_attempts;
      await supabase.rpc("complete_clinic_job", {
        p_job_id: job.id,
        p_status: retry ? "pending" : "failed",
        p_result: null,
        p_error_message: message,
      });
      failed += retry ? 0 : 1;
    }
  }

  return {
    processed: filtered.length,
    completed,
    failed,
    jobIds,
  };
}
