import { logServerError } from "@/core/errors/log-error.server";
import { runClinicJobHandler } from "@/core/jobs/handlers";
import type { ClinicJobRow } from "@/core/jobs/types";
import { createTraceId, recordObservabilityEvent } from "@/core/observability/record";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { nullToUndefined, toJson } from "@/core/supabase/json";

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
    logServerError("clinic-jobs.worker-skip", "SUPABASE_SERVICE_ROLE_KEY missing", {
      persist: false,
    });
    return { processed: 0, completed: 0, failed: 0, jobIds: [] };
  }

  const supabase = createAdminClient();
  const limit = options?.limit ?? 10;
  const workerTraceId = createTraceId();
  const workerStart = performance.now();

  const { data: claimed, error: claimError } = await supabase.rpc("claim_clinic_jobs", {
    p_limit: limit,
  });

  if (claimError) {
    void recordObservabilityEvent({
      category: "job",
      name: "worker_claim_failed",
      status: "error",
      traceId: workerTraceId,
      errorMessage: claimError.message,
      metadata: { limit },
    });
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
    const jobStart = performance.now();

    try {
      const result = await runClinicJobHandler(supabase, job);
      const durationMs = Math.round(performance.now() - jobStart);
      await supabase.rpc("complete_clinic_job", {
        p_job_id: job.id,
        p_status: "completed",
        p_result: toJson(result),
        p_error_message: nullToUndefined<string>(null),
      });
      void recordObservabilityEvent({
        clinicId: job.clinic_id,
        category: "job",
        name: `job_${job.job_type}`,
        durationMs,
        traceId: workerTraceId,
        metadata: { jobId: job.id, status: "completed" },
        path: "/api/jobs/process",
      });
      completed += 1;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      const durationMs = Math.round(performance.now() - jobStart);
      const retry = job.attempts < job.max_attempts;
      await supabase.rpc("complete_clinic_job", {
        p_job_id: job.id,
        p_status: retry ? "pending" : "failed",
        p_result: null,
        p_error_message: message,
      });
      void recordObservabilityEvent({
        clinicId: job.clinic_id,
        category: "job",
        name: `job_${job.job_type}`,
        status: retry ? "warn" : "error",
        durationMs,
        traceId: workerTraceId,
        errorMessage: message,
        metadata: { jobId: job.id, retry, attempts: job.attempts },
        path: "/api/jobs/process",
      });
      failed += retry ? 0 : 1;
    }
  }

  void recordObservabilityEvent({
    category: "job",
    name: "worker_batch",
    durationMs: Math.round(performance.now() - workerStart),
    traceId: workerTraceId,
    metadata: { processed: filtered.length, completed, failed },
    path: "/api/jobs/process",
  });

  return {
    processed: filtered.length,
    completed,
    failed,
    jobIds,
  };
}
