import type { SupabaseClient } from "@supabase/supabase-js";

import { handleGenerateReportJob } from "@/core/jobs/handlers/generate-report";
import { handleImportBatchJob } from "@/core/jobs/handlers/import-batch";
import { handleImportClinicalPdfJob } from "@/core/jobs/handlers/import-clinical-pdf";
import { handleRunAiTaskJob } from "@/core/jobs/handlers/run-ai-task";
import { handleSendReminderJob } from "@/core/jobs/handlers/send-reminder";
import type { ClinicJobType } from "@/core/jobs/registry";
import type { ClinicJobRow } from "@/core/jobs/types";
import { recordObservabilityEvent } from "@/core/observability/record";

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

  void recordObservabilityEvent({
    clinicId: job.clinic_id,
    category: "job",
    name: "mock_email_send",
    status: "ok",
    metadata: {
      recipient: payload.recipient,
      subject: payload.subject,
      simulated: true,
    },
  });
  return { status: "simulated", recipient: payload.recipient ?? "" };
}

export async function runClinicJobHandler(
  supabase: SupabaseClient,
  job: ClinicJobRow
): Promise<Record<string, unknown>> {
  const handlers: Record<
    ClinicJobType,
    (s: SupabaseClient, j: ClinicJobRow) => Promise<Record<string, unknown>>
  > = {
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
