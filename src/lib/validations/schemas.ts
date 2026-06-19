import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email("Ingresá un email válido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
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
  insurance_number: z.string().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  medical_history: z.string().optional(),
  allergies: z.string().optional(),
  regular_medication: z.string().optional(),
  notes: z.string().optional(),
});

export const appointmentSchema = z
  .object({
    patient_id: z.string().uuid("Seleccioná un paciente"),
    professional_id: z.string().uuid("Seleccioná un profesional"),
    location_id: z.string().uuid().optional().nullable(),
    specialty_id: z.string().uuid().optional().nullable(),
    start_at: z.string().min(1, "Fecha y hora requeridas"),
    end_at: z.string().min(1, "Fecha y hora requeridas"),
    status: z.enum(["pending", "confirmed", "attended", "cancelled", "no_show"]),
    notes: z.string().optional(),
    cancellation_reason: z.string().optional(),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "La hora de fin debe ser posterior al inicio",
    path: ["end_at"],
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
});

export const prescriptionMedicationSchema = z.object({
  generic_name: z.string().min(1, "Nombre genérico obligatorio (Ley 25.649)"),
  brand_name: z.string().optional(),
  presentation: z.string().optional(),
  concentration: z.string().optional(),
  quantity: z.coerce.number().int().min(1, "Cantidad mínima 1"),
  posology: z.string().min(1, "Indicá posología"),
  route: z.string().optional(),
  prolonged_treatment: z.coerce.boolean().optional(),
});

export const prescriptionDraftSchema = z.object({
  patient_id: z.string().uuid(),
  clinical_record_id: z.string().uuid().optional().nullable(),
  professional_id: z.string().uuid(),
  prescription_type: z.enum(["ambulatoria", "cronica", "duplicado"]),
  diagnosis_cie10: z.string().min(1, "CIE-10 obligatorio para receta"),
  diagnosis_text: z.string().min(1, "Diagnóstico obligatorio"),
  patient_insurance: z.string().optional(),
  medications: z.array(prescriptionMedicationSchema).min(1, "Agregá al menos un medicamento"),
  notes: z.string().optional(),
  validity_days: z.coerce.number().int().min(1).max(365).default(30),
  disclaimer_accepted: z.literal(true, {
    error: "Debés aceptar el aviso legal",
  }),
});

export function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, "")
    .trim()
    .slice(0, 10000);
}
