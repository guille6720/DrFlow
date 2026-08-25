"use server";

import { requireClinicPermission } from "@/core/actions/clinic-guard";
import { revalidateAppointmentSurfaces } from "@/core/cache/revalidate-appointment-surfaces";
import { toErrorMessage } from "@/core/errors/error-utils";
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

import { turnoWizardSchema, type TurnoWizardInput } from "@/features/turnos/utils/turno-wizard-schema";

import type { Database } from "@/types/supabase";
import type { SupabaseClient } from "@supabase/supabase-js";

function isNextNavigationError(err: unknown): boolean {
  if (typeof err !== "object" || err === null || !("digest" in err)) return false;
  const digest = String((err as { digest: string }).digest);
  return digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND");
}

function toCreateTurnoUserMessage(err: unknown): string {
  const message = toErrorMessage(err);
  if (
    message.includes("Server Components render") ||
    message.includes("omitted in production") ||
    message.includes("digest property")
  ) {
    return "No se pudo confirmar el turno. Recargá la página e intentá de nuevo.";
  }
  return message || "No se pudo confirmar el turno. Intentá de nuevo.";
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

function extractAppointmentId(rpcResult: unknown): string | null {
  if (typeof rpcResult === "object" && rpcResult !== null && "appointment_id" in rpcResult) {
    return String((rpcResult as { appointment_id: string }).appointment_id);
  }
  if (typeof rpcResult === "string") {
    try {
      return extractAppointmentId(JSON.parse(rpcResult) as unknown);
    } catch {
      return null;
    }
  }
  return null;
}

async function insertStaffAppointmentDirect(
  supabase: SupabaseClient<Database>,
  clinicId: string,
  userId: string,
  data: TurnoWizardInput
): Promise<{ ok: true; appointmentId: string } | { ok: false; error: string }> {
  if (!data.is_overbooking) {
    const { data: conflict } = await supabase
      .from("appointments")
      .select("id")
      .eq("clinic_id", clinicId)
      .eq("professional_id", data.professional_id)
      .neq("status", "cancelled")
      .lt("start_at", data.end_at)
      .gt("end_at", data.start_at)
      .limit(1)
      .maybeSingle();
    if (conflict?.id) {
      return { ok: false, error: "El horario ya no está disponible." };
    }
  }

  const { data: row, error } = await supabase
    .from("appointments")
    .insert({
      clinic_id: clinicId,
      patient_id: data.patient_id,
      professional_id: data.professional_id,
      location_id: data.location_id ?? null,
      specialty_id: data.specialty_id ?? null,
      start_at: data.start_at,
      end_at: data.end_at,
      status: "pending",
      notes: data.notes ? sanitizeText(data.notes) : null,
      booking_source: "manual",
      consultation_modality: data.consultation_modality,
      is_overbooking: data.is_overbooking,
      overbooking_reason: data.overbooking_reason
        ? sanitizeText(data.overbooking_reason)
        : null,
      priority: data.priority,
      insurance_provider_snapshot: data.insurance_provider ?? null,
      insurance_plan_snapshot: data.insurance_plan ?? null,
      created_by: userId,
    })
    .select("id")
    .single();

  if (error || !row?.id) {
    return {
      ok: false,
      error: resolvePostgresUserMessage(error, {
        fallback: error?.message || "No se pudo confirmar el turno. Intentá de nuevo.",
      }),
    };
  }

  return { ok: true, appointmentId: row.id };
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

    let appointmentId: string | null = null;

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
        const fallback = await insertStaffAppointmentDirect(supabase, clinicId, userId, data);
        if (!fallback.ok) return { error: fallback.error };
        appointmentId = fallback.appointmentId;
      } else {
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
    } else {
      appointmentId = extractAppointmentId(rpcResult);
      if (!appointmentId) {
        return { error: "El turno se creó pero no se pudo leer el identificador. Revisá la agenda." };
      }
    }

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

    // Best-effort only: never fail confirm if RSC revalidation throws.
    try {
      revalidateAppointmentSurfaces({ patientId: data.patient_id });
    } catch (revalidateErr) {
      logServerError("createTurnoWizard.revalidate", revalidateErr);
    }

    return { ok: true as const, appointmentId };
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    logServerError("createTurnoWizard", err);
    return { error: toCreateTurnoUserMessage(err) };
  }
}
