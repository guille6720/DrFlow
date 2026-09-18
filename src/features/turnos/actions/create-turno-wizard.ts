"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";
import { logServerError } from "@/core/errors/log-error.server";
import {
  isMissingRpcInSchemaCache,
  resolvePostgresUserMessage,
} from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { verifyAppointmentForeignKeys } from "@/core/security/ownership-guard";
import { nullToUndefined } from "@/core/supabase/json";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import { turnoWizardSchema } from "@/features/turnos/utils/turno-wizard-schema";

function revalidateTurnoPaths(patientId?: string) {
  revalidateAppointmentSurfaces({ patientId });
}

function mapCreateTurnoRpcError(message: string | null | undefined): string | null {
  const code = (message ?? "").trim();
  if (code === "SLOT_NOT_AVAILABLE" || code === "APPOINTMENT_SLOT_CONFLICT") {
    return "El horario ya no está disponible.";
  }
  if (code === "SLOT_BLOCKED") return "El horario está bloqueado.";
  if (code === "FORBIDDEN") return "No tenés permiso para crear turnos.";
  if (code === "PATIENT_NOT_FOUND") return "Paciente no encontrado en el consultorio activo.";
  if (code === "PROFESSIONAL_NOT_FOUND") return "Profesional no encontrado o inactivo.";
  if (code === "INVALID_TIME_RANGE") return "Horario inválido.";
  if (code === "OVERBOOKING_REASON_REQUIRED") return "Indicá el motivo del sobreturno.";
  if (code === "INVALID_MODALITY") return "Tipo de atención inválido.";
  return null;
}

export async function createTurnoWizard(input: unknown) {
  try {
    const [access, supabase] = await Promise.all([
      requireClinicPermission("manageAppointments"),
      createClient(),
    ]);
    if (!access.ok) return { error: access.error };
    const { clinicId, userId } = access;

    const parsed = turnoWizardSchema.safeParse(input);
    if (!parsed.success) return { error: firstZodIssue(parsed.error) };

    const data = parsed.data;

    const ownership = await verifyAppointmentForeignKeys(supabase, clinicId, {
      patientId: data.patient_id,
      professionalId: data.professional_id,
      locationId: data.location_id,
      specialtyId: data.specialty_id,
    });
    if (!ownership.ok) return { error: ownership.error };

    const { data: rpcResult, error } = await supabase.rpc("create_staff_appointment_atomic", {
      p_clinic_id: clinicId,
      p_patient_id: data.patient_id,
      p_professional_id: data.professional_id,
      p_start_at: data.start_at,
      p_end_at: data.end_at,
      p_location_id: nullToUndefined(data.location_id ?? null),
      p_specialty_id: nullToUndefined(data.specialty_id ?? null),
      p_notes: nullToUndefined(data.notes ? sanitizeText(data.notes) : null),
      p_consultation_modality: data.consultation_modality,
      p_is_overbooking: data.is_overbooking,
      p_overbooking_reason: nullToUndefined(
        data.overbooking_reason ? sanitizeText(data.overbooking_reason) : null
      ),
      p_priority: data.priority,
      p_insurance_provider: nullToUndefined(data.insurance_provider ?? null),
      p_insurance_plan: nullToUndefined(data.insurance_plan ?? null),
      p_created_by: userId,
    });

    if (error) {
      if (isMissingRpcInSchemaCache(error)) {
        return {
          error:
            "No se pudo crear el turno: falta o está desactualizada la función en Supabase. Ejecutá la migración 084 y después: NOTIFY pgrst, 'reload schema';",
        };
      }
      const mapped =
        mapCreateTurnoRpcError(error.message) ||
        mapCreateTurnoRpcError(error.details) ||
        mapCreateTurnoRpcError(error.hint);
      return {
        error:
          mapped ??
          resolvePostgresUserMessage(error, {
            fallback: error.message || "No se pudo confirmar el turno. Intentá de nuevo.",
          }),
      };
    }

    const appointmentId =
      typeof rpcResult === "object" &&
      rpcResult !== null &&
      "appointment_id" in rpcResult
        ? String((rpcResult as { appointment_id: string }).appointment_id)
        : null;

    if (appointmentId) {
      await recordAudit({
        clinicId,
        module: "appointments",
        what: data.is_overbooking ? "Sobreturno creado" : "Turno creado",
        entityType: "appointment",
        entityId: appointmentId,
        patientId: data.patient_id,
        action: "create",
        metadata: {
          is_overbooking: data.is_overbooking,
          priority: data.priority,
          consultation_modality: data.consultation_modality,
        },
      });
    }

    revalidateTurnoPaths(data.patient_id);
    return { data: rpcResult };
  } catch (err) {
    logServerError("createTurnoWizard", err);
    return {
      error: err instanceof Error ? err.message : "No se pudo confirmar el turno. Intentá de nuevo.",
    };
  }
}
