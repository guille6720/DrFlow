"use server";

import { revalidatePath } from "next/cache";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { resolvePostgresUserMessage } from "@/core/errors/postgres-error";
import { recordAudit } from "@/core/security/audit-service";
import { verifyAppointmentForeignKeys } from "@/core/security/ownership-guard";
import { createClient } from "@/core/supabase/server";
import { firstZodIssue } from "@/core/validations/params";
import { sanitizeText } from "@/core/validations/schemas";

import { turnoWizardSchema } from "@/features/turnos/utils/turno-wizard-schema";

const TURNO_PATHS = ["/turnos/agenda", "/turnos/nuevo", "/agenda", "/dashboard", "/atenciones"];

function revalidateTurnoPaths(patientId?: string) {
  for (const path of TURNO_PATHS) revalidatePath(path);
  if (patientId) revalidatePath(`/pacientes/${patientId}`);
}

export async function createTurnoWizard(input: unknown) {
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
    p_location_id: data.location_id ?? null,
    p_specialty_id: data.specialty_id ?? null,
    p_notes: data.notes ? sanitizeText(data.notes) : null,
    p_consultation_modality: data.consultation_modality,
    p_is_overbooking: data.is_overbooking,
    p_overbooking_reason: data.overbooking_reason
      ? sanitizeText(data.overbooking_reason)
      : null,
    p_priority: data.priority,
    p_insurance_provider: data.insurance_provider ?? null,
    p_insurance_plan: data.insurance_plan ?? null,
    p_created_by: userId,
  });

  if (error) {
    return {
      error: resolvePostgresUserMessage(error, {
        fallback:
          error.message === "SLOT_NOT_AVAILABLE"
            ? "El horario ya no está disponible."
            : error.message === "SLOT_BLOCKED"
              ? "El horario está bloqueado."
              : error.message,
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
}
