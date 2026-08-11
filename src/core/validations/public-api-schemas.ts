import { z } from "zod";

import { documentNumberSchema, entityIdSchema } from "@/core/validations/params";

export const apiListAppointmentsQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  professional_id: z.string().uuid().optional(),
  status: z
    .enum(["pending", "confirmed", "attended", "cancelled", "no_show"])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export const apiAvailabilityQuerySchema = z.object({
  professional_id: entityIdSchema,
  days_ahead: z.coerce.number().int().min(1).max(60).optional(),
});

export const apiCreateAppointmentSchema = z.object({
  professional_id: entityIdSchema,
  start_at: z.string().datetime(),
  first_name: z.string().min(1).max(120),
  last_name: z.string().min(1).max(120),
  document_number: documentNumberSchema,
  phone: z.string().min(8).max(30),
  email: z.string().email().optional().or(z.literal("")),
  reason: z.string().max(500).optional(),
});

export const createApiKeySchema = z.object({
  name: z.string().min(1, "Nombre requerido").max(80),
  scopes: z
    .array(z.enum(["appointments:read", "appointments:write", "professionals:read"]))
    .min(1),
});

export const revokeApiKeySchema = z.object({
  id: entityIdSchema,
});
