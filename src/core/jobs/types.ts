import type { ClinicJobStatus, ClinicJobType } from "@/core/jobs/registry";

import type { ReminderChannel } from "@/types/database";

export type ClinicJobRow = {
  id: string;
  clinic_id: string;
  job_type: ClinicJobType;
  status: ClinicJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type SendReminderJobPayload = {
  appointmentId: string;
  channel: ReminderChannel;
  recipient: string;
  message: string;
  reminderLogId?: string;
};

export type GenerateReportJobPayload = {
  periodStart: string;
  periodEnd: string;
  periodLabel: string;
};

export type ImportBatchJobPayload = {
  storagePath: string;
  fileName: string;
  offset: number;
  batchSize: number;
  importKind: "hce" | "patients" | "teams_jsonl";
  userId: string;
};

export type ImportClinicalPdfJobPayload = {
  storagePath: string;
  fileName: string;
  fileSize: number;
  userId: string;
  patientHints?: Record<string, string>;
};

export type RunAiTaskJobPayload = {
  task: "clinical_summary" | "soap_draft" | "proactive_followup" | "close_encounter";
  patientId: string;
  labSourceText?: string;
  enhanceWithLlm?: boolean;
  context?: Record<string, unknown>;
};

export type EnqueueClinicJobInput = {
  clinicId: string;
  jobType: ClinicJobType;
  payload: Record<string, unknown>;
  createdBy?: string;
  scheduledAt?: string;
  maxAttempts?: number;
};
