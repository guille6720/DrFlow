import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClinicJobType } from "@/lib/jobs/registry";
import type { ClinicJobRow } from "@/lib/jobs/types";
import { handleSendReminderJob } from "@/lib/jobs/handlers/send-reminder";
import { handleGenerateReportJob } from "@/lib/jobs/handlers/generate-report";

/** Placeholder handlers — wired when imports move fully off the request thread. */
export async function handleImportBatchJob(
  _supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  return {
    deferred: true,
    jobType: job.job_type,
    message: "Import batch handler registered — enqueue from import panels in a follow-up.",
    payload: job.payload,
  };
}

export async function handleImportClinicalPdfJob(
  _supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  return {
    deferred: true,
    jobType: job.job_type,
    message: "PDF import handler registered — move extract/parse off UI thread next.",
    payload: job.payload,
  };
}

export async function handleRunAiTaskJob(
  _supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  return {
    deferred: true,
    jobType: job.job_type,
    message: "IA async task placeholder — integrate LLM provider without blocking UI.",
    payload: job.payload,
  };
}

export async function handleSendEmailJob(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const payload = job.payload as {
    recipient?: string;
    subject?: string;
    message?: string;
    appointmentId?: string;
  };

  if (payload.appointmentId && payload.recipient && payload.message) {
    return handleSendReminderJob(supabase, {
      ...job,
      job_type: "send_reminder",
      payload: {
        appointmentId: payload.appointmentId,
        channel: "email",
        recipient: payload.recipient,
        message: payload.message,
      },
    });
  }

  console.log(`[MOCK EMAIL] → ${payload.recipient}: ${payload.subject}`);
  return { status: "simulated", recipient: payload.recipient ?? "" };
}

export async function runClinicJobHandler(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const handlers: Record<ClinicJobType, (s: SupabaseClient, j: ClinicJobRow) => Promise<Record<string, unknown>>> = {
    send_reminder: handleSendReminderJob,
    send_email: handleSendEmailJob,
    generate_report: handleGenerateReportJob,
    import_hce_batch: handleImportBatchJob,
    import_patients_batch: handleImportBatchJob,
    import_clinical_pdf: handleImportClinicalPdfJob,
    run_ai_task: handleRunAiTaskJob,
  };

  const handler = handlers[job.job_type];
  if (!handler) throw new Error(`No handler for job type: ${job.job_type}`);
  return handler(supabase, job);
}
