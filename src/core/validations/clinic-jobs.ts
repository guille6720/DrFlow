import { z } from "zod";

import type { ClinicJobType } from "@/core/jobs/registry";
import {
  entityIdSchema,
  firstZodIssue,
  reminderChannelSchema,
} from "@/core/validations/params";

export const clinicJobTypeSchema = z.enum([
  "send_reminder",
  "send_email",
  "generate_report",
  "import_hce_batch",
  "import_patients_batch",
  "import_clinical_pdf",
  "run_ai_task",
]);

const sendReminderPayloadSchema = z.object({
  appointmentId: entityIdSchema,
  channel: reminderChannelSchema,
  recipient: z.string().min(1).max(200),
  message: z.string().min(1).max(2000),
  reminderLogId: entityIdSchema.optional(),
});

const sendEmailPayloadSchema = z.object({
  recipient: z.string().min(1).max(200),
  subject: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  appointmentId: entityIdSchema.optional(),
});

const generateReportPayloadSchema = z.object({
  periodStart: z.string().datetime(),
  periodEnd: z.string().datetime(),
  periodLabel: z.string().min(1).max(80),
});

const importBatchPayloadSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  offset: z.coerce.number().int().min(0).max(1_000_000),
  batchSize: z.coerce.number().int().min(1).max(500),
  importKind: z.enum(["hce", "patients", "teams_jsonl"]),
  userId: entityIdSchema,
});

const importClinicalPdfPayloadSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileName: z.string().min(1).max(255),
  fileSize: z.coerce.number().int().min(1).max(50_000_000),
  userId: entityIdSchema,
  patientHints: z.record(z.string().max(80), z.string().max(200)).optional(),
});

const runAiTaskPayloadSchema = z.object({
  task: z.enum(["clinical_summary", "soap_draft", "proactive_followup", "close_encounter"]),
  patientId: entityIdSchema,
  labSourceText: z.string().max(50_000).optional(),
  enhanceWithLlm: z.boolean().optional(),
  context: z.record(z.string().max(80), z.unknown()).optional(),
});

const PAYLOAD_SCHEMAS: Record<ClinicJobType, z.ZodType<Record<string, unknown>>> = {
  send_reminder: sendReminderPayloadSchema,
  send_email: sendEmailPayloadSchema,
  generate_report: generateReportPayloadSchema,
  import_hce_batch: importBatchPayloadSchema,
  import_patients_batch: importBatchPayloadSchema,
  import_clinical_pdf: importClinicalPdfPayloadSchema,
  run_ai_task: runAiTaskPayloadSchema,
};

export function validateClinicJobEnqueue(
  jobType: unknown,
  payload: unknown
): { ok: true; jobType: ClinicJobType; payload: Record<string, unknown> } | { ok: false; error: string } {
  const typeParsed = clinicJobTypeSchema.safeParse(jobType);
  if (!typeParsed.success) return { ok: false, error: "Tipo de trabajo inválido" };

  const schema = PAYLOAD_SCHEMAS[typeParsed.data];
  const payloadParsed = schema.safeParse(payload);
  if (!payloadParsed.success) {
    return { ok: false, error: firstZodIssue(payloadParsed.error) };
  }

  return {
    ok: true,
    jobType: typeParsed.data,
    payload: payloadParsed.data,
  };
}
