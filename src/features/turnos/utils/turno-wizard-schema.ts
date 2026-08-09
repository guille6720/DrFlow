import { z } from "zod";

import { consultationModalitySchema } from "@/core/validations/params";

export const turnoWizardSchema = z
  .object({
    patient_id: z.string().uuid("Seleccioná un paciente"),
    professional_id: z.string().uuid("Seleccioná un profesional"),
    specialty_id: z.string().uuid().optional().nullable(),
    location_id: z.string().uuid().optional().nullable(),
    start_at: z.string().min(1, "Seleccioná un horario"),
    end_at: z.string().min(1, "Seleccioná un horario"),
    notes: z.string().max(2000).optional(),
    consultation_modality: consultationModalitySchema.default("presencial"),
    is_overbooking: z.boolean().default(false),
    overbooking_reason: z.string().max(500).optional().nullable(),
    priority: z.enum(["normal", "high", "urgent"]).default("normal"),
    insurance_provider: z.string().max(200).optional().nullable(),
    insurance_plan: z.string().max(120).optional().nullable(),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "Horario inválido",
    path: ["end_at"],
  })
  .refine(
    (data) =>
      !data.is_overbooking ||
      (data.overbooking_reason?.trim().length ?? 0) > 0,
    {
      message: "Indicá el motivo del sobreturno",
      path: ["overbooking_reason"],
    }
  );

export type TurnoWizardInput = z.infer<typeof turnoWizardSchema>;

export const waitingListEntrySchema = z.object({
  patient_id: z.string().uuid(),
  professional_id: z.string().uuid().optional().nullable(),
  specialty_id: z.string().uuid().optional().nullable(),
  location_id: z.string().uuid().optional().nullable(),
  preferred_date_from: z.string().optional().nullable(),
  preferred_date_to: z.string().optional().nullable(),
  preferred_time_from: z.string().optional().nullable(),
  preferred_time_to: z.string().optional().nullable(),
  consultation_modality: consultationModalitySchema.default("presencial"),
  notes: z.string().max(1000).optional(),
});
