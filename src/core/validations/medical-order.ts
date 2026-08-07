import { z } from "zod";

import {
  MEDICAL_ORDER_NOTES_MAX,
  MEDICAL_ORDER_TEXT_MAX,
  MEDICAL_ORDER_TYPES,
  optionalClinicalTextRefinement,
  requiredClinicalTextRefinement,
} from "@/core/validations/clinical-free-text";

const emptyToNull = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? null : value;

export const medicalOrderFormSchema = z.object({
  patient_id: z.string().uuid("Paciente inválido"),
  professional_id: z.string().uuid("Profesional inválido"),
  clinical_record_id: z.preprocess(
    emptyToNull,
    z.string().uuid("Consulta inválida").optional().nullable()
  ),
  order_text: z
    .string()
    .superRefine(
      requiredClinicalTextRefinement({
        fieldLabel: "La orden",
        maxLength: MEDICAL_ORDER_TEXT_MAX,
      })
    ),
  notes: z
    .string()
    .nullable()
    .optional()
    .superRefine(
      optionalClinicalTextRefinement({
        fieldLabel: "Las notas",
        maxLength: MEDICAL_ORDER_NOTES_MAX,
      })
    ),
  order_type: z.enum(MEDICAL_ORDER_TYPES, {
    message: "Tipo de orden inválido",
  }),
  idempotency_key: z.preprocess(
    emptyToNull,
    z.string().uuid("Clave de idempotencia inválida").optional().nullable()
  ),
});

export type MedicalOrderFormInput = z.infer<typeof medicalOrderFormSchema>;
