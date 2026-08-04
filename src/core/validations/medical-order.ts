import { z } from "zod";

export const medicalOrderFormSchema = z.object({
  patient_id: z.string().uuid("Paciente inválido"),
  professional_id: z.string().uuid("Profesional inválido"),
  clinical_record_id: z.string().uuid().optional().nullable(),
  order_text: z.string().min(1, "La orden es obligatoria").max(10000),
  notes: z.string().max(10000).optional().nullable(),
  order_type: z.string().min(1).max(50).default("study"),
});

export type MedicalOrderFormInput = z.infer<typeof medicalOrderFormSchema>;
