import { z } from "zod";

export const publicBookingSchema = z.object({
  slug: z.string().min(2),
  professional_id: z.string().uuid("Seleccioná un profesional"),
  start_at: z.string().min(1, "Seleccioná un horario"),
  first_name: z.string().min(1, "Nombre requerido"),
  last_name: z.string().min(1, "Apellido requerido"),
  document_number: z.string().min(6, "DNI inválido"),
  phone: z.string().min(8, "Teléfono requerido"),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  reason: z.string().optional(),
});
