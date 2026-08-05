import { z } from "zod";

import { entityIdSchema, optionalEntityIdSchema } from "@/core/validations/params";

export const clinicSettingsSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(120),
  phone: z.string().max(40).optional().nullable(),
  email: z
    .string()
    .email("Email inválido")
    .max(120)
    .optional()
    .or(z.literal(""))
    .nullable(),
  address: z.string().max(300).optional().nullable(),
  default_appointment_duration: z.coerce.number().int().min(5).max(240),
  voice_input_enabled: z.boolean(),
});

export const namedEntitySchema = z.string().min(1, "Nombre requerido").max(80);

export const createLocationSchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(80),
  address: z.string().max(300).optional(),
});

export const createProfessionalSchema = z.object({
  display_name: z.string().min(1, "Nombre del profesional requerido").max(120),
  specialty_id: optionalEntityIdSchema,
  user_id: optionalEntityIdSchema,
  license_number: z.string().max(50).optional().nullable(),
});

export const createScheduleBlockSchema = z
  .object({
    professional_id: entityIdSchema,
    start_at: z.string().min(1, "Fecha de inicio requerida"),
    end_at: z.string().min(1, "Fecha de fin requerida"),
    reason: z.string().max(200).default("Bloqueo"),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "La hora de fin debe ser posterior al inicio",
    path: ["end_at"],
  });

export const clinicCoveragesSchema = z.object({
  coverages: z.array(z.string().max(80)).max(50),
  custom_coverages: z.string().max(2000).optional(),
  default_insurance: z.string().max(80).optional(),
});

export function parseClinicSettingsForm(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    address: String(formData.get("address") ?? "").trim() || null,
    default_appointment_duration: formData.get("default_appointment_duration"),
    voice_input_enabled: formData.get("voice_input_enabled") === "on",
  };
}

export function parseCreateProfessionalForm(formData: FormData) {
  const specialtyId = String(formData.get("specialty_id") ?? "").trim();
  const userId = String(formData.get("user_id") ?? "").trim();
  return {
    display_name: String(formData.get("display_name") ?? "").trim(),
    specialty_id: specialtyId || null,
    user_id: userId || null,
    license_number: String(formData.get("license_number") ?? "").trim() || null,
  };
}

export const agendaRuleSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}$/),
  end_time: z.string().regex(/^\d{2}:\d{2}$/),
  slot_duration: z.number().int().min(10).max(120),
});

/** Form POST schema for createAvailabilityRule (coerced form fields). */
export const createAvailabilityRuleSchema = z.object({
  professional_id: z.string().uuid(),
  day_of_week: z.coerce.number().min(0).max(6),
  start_time: z.string(),
  end_time: z.string(),
  slot_duration: z.coerce.number().min(10).max(120).default(30),
});

export function parseScheduleBlockForm(formData: FormData) {
  return {
    professional_id: String(formData.get("professional_id") ?? ""),
    start_at: String(formData.get("start_at") ?? ""),
    end_at: String(formData.get("end_at") ?? ""),
    reason: String(formData.get("reason") ?? "").trim() || "Bloqueo",
  };
}
