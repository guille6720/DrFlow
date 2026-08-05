import { z } from "zod";

import type { ClinicalAiTask } from "@/lib/utils/clinical-ai-orchestrator";

const TASK_VALUES = [
  "pre_visit_brief",
  "consultation_documentation",
  "medication_order_assist",
  "lab_interpretation",
  "close_encounter",
  "proactive_followup",
  "copilot_query",
  "clinical_summary",
  "soap_draft",
] as const satisfies readonly ClinicalAiTask[];

export const clinicalAiRequestSchema = z.object({
  task: z.enum(TASK_VALUES),
  message: z.string().max(8000).optional(),
  patientId: z.string().uuid().optional(),
  patientName: z.string().max(200).optional(),
  labSourceText: z.string().max(50000).optional(),
  assistContext: z.record(z.string(), z.unknown()).optional(),
  copilotContext: z.record(z.string(), z.unknown()).optional(),
  chart: z.record(z.string(), z.unknown()).optional(),
  lastConsultAt: z.string().nullable().optional(),
  enhanceWithLlm: z.boolean().optional(),
});

export type ClinicalAiRequest = z.infer<typeof clinicalAiRequestSchema>;
