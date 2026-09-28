import { z } from "zod";

import { MEDICAL_ORDER_TEXT_MAX } from "@/core/validations/clinical-free-text";

import {
  IMAGING_CONTRAST_OPTIONS,
  MEDICAL_ORDER_CATEGORIES,
  MEDICAL_ORDER_PRIORITIES,
} from "@/features/ordenes-medicas/constants";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida")
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const medicalOrderItemSchema = z.object({
  code: optionalText(60),
  name: z.string().trim().min(1, "Indicá el estudio o práctica").max(300, "Máximo 300 caracteres"),
  description: optionalText(2000),
  imaging: z
    .object({
      body_region: optionalText(200),
      contrast: z.enum(IMAGING_CONTRAST_OPTIONS).optional().nullable(),
      indication: optionalText(1000),
      observations: optionalText(1000),
    })
    .optional()
    .nullable(),
});

export const medicalOrderInputSchema = z
  .object({
    patient_id: z.string().uuid("Paciente inválido"),
    clinical_record_id: z.string().uuid().optional().nullable(),
    category: z.enum(MEDICAL_ORDER_CATEGORIES, { message: "Tipo de orden inválido" }),
    items: z.array(medicalOrderItemSchema).min(1, "Agregá al menos un estudio o práctica").max(60),
    diagnosis_text: optionalText(500),
    diagnosis_code: optionalText(20),
    clinical_indication: optionalText(2000),
    preparation_instructions: optionalText(2000),
    notes: optionalText(2000),
    priority: z.enum(MEDICAL_ORDER_PRIORITIES).default("normal"),
    valid_until: isoDate,
    idempotency_key: z.string().uuid().optional().nullable(),
  })
  .superRefine((value, ctx) => {
    const today = new Date().toISOString().slice(0, 10);
    if (value.valid_until && value.valid_until < today) {
      ctx.addIssue({
        code: "custom",
        path: ["valid_until"],
        message: "La fecha de validez no puede ser anterior a hoy",
      });
    }
    const text = value.items.map((i) => i.name).join("\n");
    if (text.length > MEDICAL_ORDER_TEXT_MAX) {
      ctx.addIssue({ code: "custom", path: ["items"], message: "La orden es demasiado extensa" });
    }
  });

export type MedicalOrderInput = z.infer<typeof medicalOrderInputSchema>;
export type MedicalOrderInputRaw = z.input<typeof medicalOrderInputSchema>;

export const cancelMedicalOrderSchema = z.object({
  order_id: z.string().uuid("Orden inválida"),
  reason: z
    .string()
    .trim()
    .min(5, "Indicá el motivo de la anulación (mínimo 5 caracteres)")
    .max(500, "Máximo 500 caracteres"),
});

export const shareMedicalOrderEmailSchema = z.object({
  order_id: z.string().uuid("Orden inválida"),
  email: z.string().trim().email("Email inválido").max(254),
});
