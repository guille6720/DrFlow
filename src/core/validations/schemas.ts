import { z } from "zod";

import {
  optionalClinicalTextRefinement,
  PRESCRIPTION_DIAGNOSIS_CIE10_MAX,
  PRESCRIPTION_DIAGNOSIS_TEXT_MAX,
  PRESCRIPTION_MEDICATION_NAME_MAX,
  PRESCRIPTION_MEDICATIONS_JSON_MAX,
  PRESCRIPTION_NOTES_MAX,
  PRESCRIPTION_POSOLOGY_MAX,
  requiredClinicalTextRefinement,
} from "@/core/validations/clinical-free-text";

export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const setupClinicSchema = z.object({
  clinicName: z.string().min(2, "Ingresá el nombre de la clínica (mín. 2 caracteres)"),
  slug: z
    .string()
    .min(2, "El identificador URL debe tener al menos 2 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Usá solo minúsculas, números y guiones. Ejemplo: mi-clinica-norte"
    ),
});

export const registerClinicSchema = z.object({
  clinicName: z.string().min(2, "Ingresá el nombre de la clínica (mín. 2 caracteres)"),
  slug: z
    .string()
    .min(2, "El identificador URL debe tener al menos 2 caracteres")
    .regex(
      /^[a-z0-9-]+$/,
      "Usá solo minúsculas, números y guiones. Ejemplo: mi-clinica-norte"
    ),
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

export const patientSchema = z.object({
  first_name: z.string().min(1, "Nombre requerido"),
  last_name: z.string().min(1, "Apellido requerido"),
  document_number: z.string().min(6, "DNI inválido"),
  birth_date: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  address: z.string().optional(),
  insurance_provider: z.string().optional(),
  insurance_plan: z.string().max(120).optional().nullable(),
  insurance_number: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  medical_history: z.string().optional(),
  allergies: z.string().optional(),
  regular_medication: z.string().optional(),
  notes: z.string().optional(),
});

const appointmentBodyFields = {
  patient_id: z.string().uuid("Seleccioná un paciente"),
  professional_id: z.string().uuid("Seleccioná un profesional"),
  location_id: z.string().uuid().optional().nullable(),
  specialty_id: z.string().uuid().optional().nullable(),
  start_at: z.string().min(1, "Fecha y hora requeridas"),
  end_at: z.string().min(1, "Fecha y hora requeridas"),
  notes: z.string().optional(),
  cancellation_reason: z.string().optional(),
};

const appointmentDateRefine = {
  refine: (data: { start_at: string; end_at: string }) =>
    new Date(data.end_at) > new Date(data.start_at),
  message: "La hora de fin debe ser posterior al inicio" as const,
  path: ["end_at"] as const,
};

/** Body for update — status comes from existing row, not form. */
export const updateAppointmentBodySchema = z
  .object(appointmentBodyFields)
  .refine(appointmentDateRefine.refine, {
    message: appointmentDateRefine.message,
    path: [...appointmentDateRefine.path],
  });

export const appointmentSchema = z
  .object({
    ...appointmentBodyFields,
    status: z.enum(["pending", "confirmed", "attended", "cancelled", "no_show"]),
  })
  .refine(appointmentDateRefine.refine, {
    message: appointmentDateRefine.message,
    path: [...appointmentDateRefine.path],
  });

export const clinicalRecordSchema = z.object({
  patient_id: z.string().uuid(),
  appointment_id: z.string().uuid().optional().nullable(),
  professional_id: z.string().uuid(),
  chief_complaint: z.string().optional(),
  diagnosis: z.string().optional(),
  evolution: z.string().optional(),
  indications: z.string().optional(),
  professional_signature: z.string().optional(),
  consultation_at: z.string().optional().nullable(),
  diagnosis_cie10: z.string().optional().nullable(),
  diagnoses_json: z.string().optional().nullable(),
  treatments_json: z.string().optional().nullable(),
});

export const prescriptionMedicationSchema = z.object({
  generic_name: z
    .string()
    .superRefine(
      requiredClinicalTextRefinement({
        fieldLabel: "El nombre genérico",
        maxLength: PRESCRIPTION_MEDICATION_NAME_MAX,
      })
    ),
  brand_name: z
    .string()
    .optional()
    .superRefine(
      optionalClinicalTextRefinement({
        fieldLabel: "La marca",
        maxLength: PRESCRIPTION_MEDICATION_NAME_MAX,
      })
    ),
  presentation: z
    .string()
    .optional()
    .superRefine(
      optionalClinicalTextRefinement({
        fieldLabel: "La presentación",
        maxLength: PRESCRIPTION_MEDICATION_NAME_MAX,
      })
    ),
  concentration: z
    .string()
    .optional()
    .superRefine(
      optionalClinicalTextRefinement({
        fieldLabel: "La concentración",
        maxLength: PRESCRIPTION_MEDICATION_NAME_MAX,
      })
    ),
  quantity: z.coerce.number().int().min(1, "Cantidad mínima 1"),
  posology: z
    .string()
    .superRefine(
      requiredClinicalTextRefinement({
        fieldLabel: "La posología",
        maxLength: PRESCRIPTION_POSOLOGY_MAX,
      })
    ),
  route: z
    .string()
    .optional()
    .superRefine(
      optionalClinicalTextRefinement({
        fieldLabel: "La vía",
        maxLength: 120,
      })
    ),
  prolonged_treatment: z.coerce.boolean().optional(),
});

export const prescriptionDraftSchema = z
  .object({
    patient_id: z.string().uuid(),
    clinical_record_id: z.preprocess(
      (value) => (typeof value === "string" && value.trim() === "" ? null : value),
      z.string().uuid().optional().nullable()
    ),
    professional_id: z.string().uuid(),
    prescription_type: z.enum(["ambulatoria", "cronica", "duplicado"]),
    diagnosis_cie10: z
      .string()
      .superRefine(
        requiredClinicalTextRefinement({
          fieldLabel: "El CIE-10",
          maxLength: PRESCRIPTION_DIAGNOSIS_CIE10_MAX,
        })
      ),
    diagnosis_text: z
      .string()
      .superRefine(
        requiredClinicalTextRefinement({
          fieldLabel: "El diagnóstico",
          maxLength: PRESCRIPTION_DIAGNOSIS_TEXT_MAX,
        })
      ),
    patient_insurance: z
      .string()
      .optional()
      .superRefine(
        optionalClinicalTextRefinement({
          fieldLabel: "La cobertura",
          maxLength: 200,
        })
      ),
    insurance_number: z
      .string()
      .optional()
      .superRefine(
        optionalClinicalTextRefinement({
          fieldLabel: "El número de afiliado",
          maxLength: 80,
        })
      ),
    insurance_plan: z
      .string()
      .optional()
      .superRefine(
        optionalClinicalTextRefinement({
          fieldLabel: "El plan",
          maxLength: 120,
        })
      ),
    coverage_kind: z.enum(["PAMI", "OBRAS_SOCIALES", "PREPAGAS", "PARTICULAR"]).optional(),
    idempotency_key: z.string().uuid().optional().nullable(),
    medications: z.array(prescriptionMedicationSchema).min(1, "Agregá al menos un medicamento"),
    notes: z
      .string()
      .optional()
      .superRefine(
        optionalClinicalTextRefinement({
          fieldLabel: "Las notas",
          maxLength: PRESCRIPTION_NOTES_MAX,
        })
      ),
    validity_days: z.coerce.number().int().min(1).max(365).default(30),
    disclaimer_accepted: z.literal(true, {
      error: "Debés aceptar el aviso legal",
    }),
  })
  .superRefine((data, ctx) => {
    if (JSON.stringify(data.medications).length > PRESCRIPTION_MEDICATIONS_JSON_MAX) {
      ctx.addIssue({
        code: "custom",
        message:
          "La receta contiene demasiados datos. Reducí la cantidad de medicamentos o el texto.",
        path: ["medications"],
      });
    }
  });

export function sanitizeText(input: string): string {
  return input
    .replace(/\0/g, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/javascript:/gi, "")
    .replace(/data:text\/html/gi, "")
    .trim()
    .slice(0, 10000);
}

const PATIENT_SANITIZE_KEYS = [
  "first_name",
  "last_name",
  "address",
  "insurance_provider",
  "insurance_number",
  "emergency_contact_name",
  "emergency_contact_phone",
  "medical_history",
  "allergies",
  "regular_medication",
  "notes",
] as const;

/** Sanitiza campos de texto libre del paciente (HC, alergias, notas). */
export function sanitizePatientFields<T extends Record<string, unknown>>(data: T): T {
  const out = { ...data };
  for (const key of PATIENT_SANITIZE_KEYS) {
    const value = out[key];
    if (typeof value === "string" && value.length > 0) {
      (out as Record<string, unknown>)[key] = sanitizeText(value);
    }
  }
  return out;
}
