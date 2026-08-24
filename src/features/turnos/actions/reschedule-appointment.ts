"use server";

import { z } from "zod";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue, parseEntityId } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

const rescheduleSchema = z
  .object({
    appointment_id: z.string().uuid(),
    start_at: z.string().min(1),
    end_at: z.string().min(1),
    reason: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.end_at) > new Date(data.start_at), {
    message: "Horario inválido",
    path: ["end_at"],
  });

function revalidateTurnoPaths(patientId?: string) {
  revalidateAppointmentSurfaces({ patientId });
}

export async function rescheduleAppointment(input: unknown) {
  const [access, supabase] = await Promise.all([
    requireClinicPermission("manageAppointments"),
    createClient(),
  ]);
  if (!access.ok) return { error: access.error };
  const { clinicId, userId } = access;

  const parsed = rescheduleSchema.safeParse(input);
  if (!parsed.success) return { error: firstZodIssue(parsed.error) };

  const idParsed = parseEntityId(parsed.data.appointment_id, "Turno");
  if (!idParsed.ok) return { error: idParsed.error };

  const { data: existing } = await supabase
    .from("appointments")
    .select("patient_id")
    .eq("id", idParsed.data)
    .eq("clinic_id", clinicId)
    .single();

  if (!existing) return { error: "Turno no encontrado" };

  const { data: rpcResult, error } = await supabase.rpc("reschedule_appointment_atomic", {
    p_clinic_id: clinicId,
    p_appointment_id: idParsed.data,
    p_new_start_at: parsed.data.start_at,
    p_new_end_at: parsed.data.end_at,
    p_changed_by: userId,
    p_reason: nullToUndefined(parsed.data.reason ? sanitizeText(parsed.data.reason) : null),
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback:
          error.message === "SLOT_NOT_AVAILABLE"
            ? "El horario ya no está disponible."
            : error.message === "SLOT_BLOCKED"
              ? "El horario está bloqueado."
              : error.message === "APPOINTMENT_NOT_RESCHEDULABLE"
                ? "No se puede reprogramar este turno."
                : error.message,
      }),
    };
  }

  await recordAudit({
    clinicId,
    module: "appointments",
    what: "Turno reprogramado",
    entityType: "appointment",
    entityId: idParsed.data,
    patientId: existing.patient_id as string,
    action: "update",
    metadata: { rpcResult },
  });

  revalidateTurnoPaths(existing.patient_id as string);
  return { data: rpcResult };
}
