import { z } from "zod";

/** UUID de entidad (paciente, turno, job, etc.). */
export const entityIdSchema = z.string().uuid("ID inválido");

export const optionalEntityIdSchema = z.string().uuid().optional().nullable();

export const entityIdArraySchema = z.array(entityIdSchema).max(50);

export const bookingSlugSchema = z
  .string()
  .min(2, "Link inválido")
  .max(80)
  .regex(/^[a-z0-9-]+$/, "Link inválido");

export const documentNumberSchema = z
  .string()
  .min(6, "DNI inválido")
  .max(20)
  .regex(/^[\d.\-\s]+$/, "DNI inválido");

export const boundedReasonSchema = z.string().min(3).max(500);

export const searchQuerySchema = z.string().min(2).max(100);

export const appointmentStatusSchema = z.enum([
  "pending",
  "confirmed",
  "attended",
  "cancelled",
  "no_show",
]);

export const reminderChannelSchema = z.enum(["email", "whatsapp", "internal"]);

export const appShareChannelSchema = z.enum(["whatsapp", "copy"]);

export const pharmacologySearchTypeSchema = z.enum(["pathology", "symptoms"]);

export const staffRoleSchema = z.enum(["clinic_admin", "doctor", "secretary"]);

export const consultationModalitySchema = z.enum(["presencial", "virtual"]);

export type ParseFail = { ok: false; error: string };
export type ParseOk<T> = { ok: true; data: T };

export function parseEntityId(value: unknown, label = "ID"): ParseOk<string> | ParseFail {
  const parsed = entityIdSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: `${label} inválido` };
  return { ok: true, data: parsed.data };
}

export function firstZodIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Datos inválidos";
}
