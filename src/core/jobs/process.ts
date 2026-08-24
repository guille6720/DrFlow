import { logServerError } from "@/core/errors/log-error.server";
import { runClinicJobHandler } from "@/core/jobs/handlers";
import {
  CLINIC_JOB_REGISTRY,
  type ClinicJobStatus,
  type ClinicJobType,
} from "@/core/jobs/registry";
import type { ClinicJobRow } from "@/core/jobs/types";
import { createTraceId, recordObservabilityEvent } from "@/core/observability/record";
import { createAdminClient, hasAdminClient } from "@/core/supabase/admin";
import { toJson } from "@/core/supabase/json";

import type { Json } from "@/types/supabase";

export type ProcessJobsResult = {
  processed: number;
  completed: number;
  failed: number;
  jobIds: string[];
};

const JOB_TYPES = new Set<string>(CLINIC_JOB_REGISTRY.map((j) => j.id));
const JOB_STATUSES = new Set<string>([
  "pending",
  "running",
  "completed",
  "failed",
  "cancelled",
]);

function isClinicJobType(value: string): value is ClinicJobType {
  return JOB_TYPES.has(value);
}

function isClinicJobStatus(value: string): value is ClinicJobStatus {
  return JOB_STATUSES.has(value);
}

function jsonObjectOrEmpty(value: Json | null | undefined): Record<string, unknown> {
  if (value === null || value === undefined) return {};
  if (typeof value === "object" && !Array.isArray(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      out[key] = entry;
    }
    return out;
  }
  return {};
}

function mapJobRow(row: {
  id: string;
  clinic_id: string;
  job_type: string;
  status: string;
  payload: Json;
  result: Json | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}): ClinicJobRow | null {
  if (!isClinicJobType(row.job_type) || !isClinicJobStatus(row.status)) {
    return null;
  }
  return {
    id: row.id,
    clinic_id: row.clinic_id,
    job_type: row.job_type,
    status: row.status,
    payload: jsonObjectOrEmpty(row.payload),
    result: row.result === null ? null : jsonObjectOrEmpty(row.result),
    error_message: row.error_message,
    attempts: row.attempts,
    max_attempts: row.max_attempts,
    scheduled_at: row.scheduled_at,
    started_at: row.started_at,
    completed_at: row.completed_at,
    created_by: row.created_by,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
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

  const jobs = claimed ?? [];
  const filtered = options?.clinicId
    ? jobs.filter((j) => j.clinic_id === options.clinicId)
    : jobs;

  let completed = 0;
  let failed = 0;
  const jobIds: string[] = [];

  for (const raw of filtered) {
    const job = mapJobRow(raw);
    if (!job) {
      failed += 1;
      continue;
    }
    jobIds.push(job.id);
    const jobStart = performance.now();

    try {
      const result = await runClinicJobHandler(supabase, job);
      const durationMs = Math.round(performance.now() - jobStart);
      await supabase.rpc("complete_clinic_job", {
        p_job_id: job.id,
        p_status: "completed",
        p_result: toJson(result),
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
