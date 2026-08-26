import { z } from "zod";

import { bookingSlugSchema, boundedReasonSchema, documentNumberSchema, entityIdArraySchema, entityIdSchema } from "@/core/validations/params";

export const publicBookingSchema = z.object({
  slug: bookingSlugSchema,
  professional_id: entityIdSchema,
  start_at: z.string().min(1, "Seleccioná un horario"),
  first_name: z.string().min(1, "Nombre requerido").max(120),
  last_name: z.string().min(1, "Apellido requerido").max(120),
  document_number: documentNumberSchema,
  phone: z.string().min(8, "Teléfono requerido").max(30),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  reason: z.string().max(500).optional(),
  privacy_consent: z.enum(["true"], {
    error: "Debés aceptar el tratamiento de datos para solicitar el turno.",
  }),
});

export const publicBookingStatusesSchema = z.object({
  slug: bookingSlugSchema,
  appointment_ids: entityIdArraySchema,
});

export const publicBookingCancelSchema = z.object({
  slug: bookingSlugSchema,
  appointment_id: entityIdSchema,
  reason: boundedReasonSchema,
});

export const publicBookingSlotsSchema = z.object({
  slug: bookingSlugSchema,
  professional_id: entityIdSchema,
});

export const publicBookingPortalAppointmentsSchema = z.object({
  slug: bookingSlugSchema,
});
